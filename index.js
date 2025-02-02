const express = require('express');
const app = express();
const axios = require('axios');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
const cors = require('cors');
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

require('dotenv').config();

// Middleware setup
app.use(cookieParser());
app.use(cors());

// Constants
const CLIENT_KEY = "sbaw2jvhniyw1woysb";
const CLIENT_SECRET = "5rwMEGrQbOUucP7MQLjCqqo6p8wGguPs";
const SERVER_ENDPOINT_REDIRECT = "https://tik-tok-flow.vercel.app/api/callback";

// Server listening on port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Step 1: Redirect user to TikTok for login
app.get('/api/oauth', (req, res) => {
    const csrfState = Math.random().toString(36).substring(2);
    res.cookie('csrfState', csrfState, { maxAge: 60000 });

    let url = 'https://www.tiktok.com/v2/auth/authorize';
    url += `?client_key=${CLIENT_KEY}`;
    url += '&scope=user.info.basic,video.publish';
    url += '&response_type=code';
    url += `&redirect_uri=${encodeURIComponent(SERVER_ENDPOINT_REDIRECT)}`;
    url += `&state=${csrfState}`;

    res.redirect(url);
});

app.get("/api/callback", async (req, res) => {
    try {
        const { code } = req.query;
        const decode = decodeURI(code);
        const tokenEndpoint = "https://open.tiktokapis.com/v2/oauth/token/";

        const params = {
            client_key: CLIENT_KEY,
            client_secret: CLIENT_SECRET,
            code: decode,
            grant_type: "authorization_code",
            redirect_uri: SERVER_ENDPOINT_REDIRECT,
        };

        // Fetch access token
        const response = await axios.post(
            tokenEndpoint,
            querystring.stringify(params),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Cache-Control": "no-cache",
                },
            }
        );

        if (response.data.access_token) {
            const accessToken = response.data.access_token;

            // Fetch user information
            const userInfoResponse = await axios.get(
                "https://open.tiktokapis.com/v2/user/info/",
                {
                    params: {
                        fields: "open_id,union_id,avatar_url,display_name",
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            // Upload Video
            const uploadResult = await uploadToTikTok(accessToken);

            const data = {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                scope: response.data.scope,
                user_info: userInfoResponse.data,
                upload_result: uploadResult,
            };

            res.send(data);
        } else {
            res.status(400).send({ error: "Access token not found in the response" });
        }
    } catch (error) {
        console.error("Error during callback:", error.message);
        res.status(500).send({ error: "An error occurred during callback", errorDetails: error.message });
    }
});

// Video Upload Functions
const VIDEO_URL = 'https://videos.pexels.com/video-files/8714839/8714839-uhd_2560_1440_25fps.mp4';
const TEMP_DIR = '/tmp'; // Use the '/tmp' directory for Vercel
const FILE_PATH = `${TEMP_DIR}/video.mp4`; // Store the video file in the /tmp directory

async function ensureTempDirectory() {
    // '/tmp' directory should already exist, so no need to create it manually on Vercel
}

async function downloadVideo() {
    console.log('Downloading video...');
    const response = await axios({ url: VIDEO_URL, method: 'GET', responseType: 'stream' });

    const writer = fs.createWriteStream(FILE_PATH);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            console.log('Download complete.');
            resolve();
        });
        writer.on('error', reject);
    });
}

async function initializeUpload(ACCESS_TOKEN) {
    console.log('Initializing upload...');
    const response = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/video/init/',
        {
            post_info: {
                title: 'My awesome video!',  // Provide a title for the video
                description: 'This is an example video.',  // Add a description if needed
                privacy_level: 'SELF_ONLY'  // Adjust privacy level as required
            },
            source_info: { source: 'FILE_UPLOAD' }
        },
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    const { upload_url, publish_id } = response.data.data;
    console.log('Upload initialized:', { upload_url, publish_id });
    return { upload_url, publish_id };
}


async function uploadVideo(uploadUrl) {
    console.log('Uploading video...');
    const fileStream = fs.createReadStream(FILE_PATH);
    const response = await axios.put(uploadUrl, fileStream, {
        headers: { 'Content-Type': 'video/mp4' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });

    console.log('Upload response:', response.status);
    return response.status === 200;
}

async function publishVideo(publishId, ACCESS_TOKEN) {
    console.log('Publishing video...');
    const response = await axios.post(
        'https://open.tiktokapis.com/v2/post/publish/video/commit/',
        { publish_id: publishId },
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
    );

    console.log('Video published successfully!');
    return response.data;
}

async function uploadToTikTok(access_token) {
    try {
        await downloadVideo(); // No need to create the temp directory manually, it's handled by Vercel.
        const { upload_url, publish_id } = await initializeUpload(access_token);
        const uploadSuccess = await uploadVideo(upload_url);
        if (uploadSuccess) {
            return await publishVideo(publish_id, access_token);
        } else {
            throw new Error("Upload failed");
        }
    } catch (error) {
        console.error('Error:', error.response?.data || error);
        return error.response?.data || error;
    }
}






// const uploadVideoToTikTok = async (accessToken) => {
//     try {
//         const videoUrl = "https://videos.pexels.com/video-files/8714839/8714839-uhd_2560_1440_25fps.mp4";
//         const videoPath = "/tmp/video.mp4"; // Temp directory for Lambda functions

//         // Step 1: Download the video
//         const response = await axios({
//             url: videoUrl,
//             method: "GET",
//             responseType: "stream",
//         });

//         const writer = fs.createWriteStream(videoPath);
//         response.data.pipe(writer);

//         await new Promise((resolve, reject) => {
//             writer.on("finish", resolve);
//             writer.on("error", reject);
//         });

//         console.log("Video downloaded successfully.");

//         // Step 2: Get video file size
//         const videoStats = fs.statSync(videoPath);
//         const videoSize = videoStats.size;
//         const chunkSize = 10 * 1024 * 1024; // 10MB
//         const totalChunks = Math.ceil(videoSize / chunkSize);

//         // Step 3: Initialize video upload
//         const initResponse = await axios.post(
//             "https://open.tiktokapis.com/v2/post/publish/video/init/",
//             {
//                 post_info: {
//                     title: "My Test Video",
//                     privacy_level: "PUBLIC",
//                     disable_duet: false,
//                     disable_comment: false,
//                     disable_stitch: false,
//                     video_cover_timestamp_ms: 1000,
//                 },
//                 source_info: {
//                     source: "FILE_UPLOAD",
//                     video_size: videoSize,
//                     chunk_size: chunkSize,
//                     total_chunk_count: totalChunks,
//                 }
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${accessToken}`,
//                     "Content-Type": "application/json; charset=UTF-8",
//                 },
//             }
//         );

//         if (!initResponse.data || !initResponse.data.data || !initResponse.data.data.upload_url) {
//             throw new Error("Failed to initialize upload");
//         }

//         const uploadUrl = initResponse.data.data.upload_url;
//         console.log("Upload initialized. URL:", uploadUrl);

//         // Step 4: Upload chunks
//         const uploadChunk = async (chunkData, chunkIndex) => {
//             const formData = new FormData();
//             formData.append("video_file", chunkData, { filename: `chunk_${chunkIndex + 1}.mp4` });

//             try {
//                 const uploadResponse = await axios.post(uploadUrl, formData, {
//                     headers: {
//                         Authorization: `Bearer ${accessToken}`,
//                         ...formData.getHeaders(), // Important for multipart uploads
//                     },
//                 });

//                 console.log(`Chunk ${chunkIndex + 1} uploaded successfully.`);
//                 return { chunkIndex: chunkIndex + 1, status: "success" };
//             } catch (error) {
//                 console.error(`Error uploading chunk ${chunkIndex + 1}:`, error.message);
//                 return { chunkIndex: chunkIndex + 1, status: "failure", error: error.message };
//             }
//         };

//         const uploadResults = [];
//         const videoStream = fs.createReadStream(videoPath, { highWaterMark: chunkSize });

//         let chunkIndex = 0;
//         for await (const chunk of videoStream) {
//             console.log(`Uploading chunk ${chunkIndex + 1}...`);
//             const result = await uploadChunk(Buffer.from(chunk), chunkIndex);
//             uploadResults.push(result);
//             chunkIndex++;
//         }

//         // Step 5: Cleanup
//         fs.unlinkSync(videoPath);
//         console.log("Video file removed.");

//         // Step 6: Finalize upload
//         const allChunksUploaded = uploadResults.every((r) => r.status === "success");

//         if (allChunksUploaded) {
//             console.log("All chunks uploaded successfully.");
//             return { success: true, message: "Video uploaded successfully", results: uploadResults };
//         } else {
//             console.log("Some chunks failed to upload.");
//             return { success: false, message: "Video upload failed", results: uploadResults };
//         }
//     } catch (error) {
//         console.error("Error uploading video:", error.message);
//         return { success: false, message: "Video upload failed", details: error };
//     }
// };

// const videoUrl = "https://videos.pexels.com/video-files/8714839/8714839-uhd_2560_1440_25fps.mp4"; // Replace with the publicly accessible video URL
// const postTitle = "My Test Video"; // Replace with your post title

// const publishVideo = async (accessToken) => {
//   try {
//     const response = await axios.post(
//       "https://open.tiktokapis.com/v2/post/publish/video/init/",
//       {
//         post_info: {
//           privacy_level: "SELF_ONLY", // Set video privacy
//           title: postTitle, // Video title
//           video_cover_timestamp_ms: 1000, // Time to pick as cover photo
//         },
//         source_info: {
//           source: "PULL_FROM_URL",
//           video_url: videoUrl, // Publicly accessible video URL
//         },
//       },
//       {
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${accessToken}`, // Attach the access token
//         },
//       }
//     );

//     console.log("Video upload response:", response.data);
//     return response.data;
//   } catch (error) {
//     return error.response.data;
//     console.error("Error uploading video:", error.response ? error.response.data : error.message);
//   }
// };





// Step 4: Home route for testing
app.get('/', (req, res) => {
    res.send('Welcome to the TikTok OAuth server. Navigate to /oauth to start the login process.');
});
