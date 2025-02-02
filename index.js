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

// Constants (replace with your actual values)
const CLIENT_KEY = "sbaw2jvhniyw1woysb"; // Your TikTok client key from the developer portal
const CLIENT_SECRET = "5rwMEGrQbOUucP7MQLjCqqo6p8wGguPs"; // Your TikTok client secret
const SERVER_ENDPOINT_REDIRECT = "https://tik-tok-flow.vercel.app/api/callback"; // Your redirect URI

// Server listening on port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Step 1: Redirect user to TikTok for login
app.get('/api/oauth', (req, res) => {
    const csrfState = Math.random().toString(36).substring(2); // Generate a CSRF token
    res.cookie('csrfState', csrfState, { maxAge: 60000 }); // Set CSRF token as a cookie

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
        const { code, state } = req.query;
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

        // Check if access token is available
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

            // Call the uploadVideoToTikTok function and wait for the result
            const uploadResult = await uploadVideoToTikTok(accessToken);

            // Combine all data
            const data = {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                scope: response.data.scope,
                user_info: userInfoResponse.data,
                upload_result: uploadResult,  // Include the upload result here
            };

            // Send the response
            res.send(data);
        } else {
            res.status(400).send({
                error: "Access token not found in the response",
            });
        }
    } catch (error) {
        console.error("Error during callback:", error.message);
        res.status(500).send({
            error: "An error occurred during callback",
            errorDetails: error.message,
        });
    }
});

// Function to download and upload video


// const uploadVideoToTikTok = async (accessToken) => {
//     try {
//         const videoUrl = "https://videos.pexels.com/video-files/8714839/8714839-uhd_2560_1440_25fps.mp4";
//         const videoPath = '/tmp/video.mp4';  // Save the video in the /tmp directory

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

//         // Step 2: Split the video into chunks
//         const chunkSize = 10000000; // 10MB per chunk
//         const videoStats = fs.statSync(videoPath);
//         const totalChunks = Math.ceil(videoStats.size / chunkSize); // Total number of chunks

//         // Initialize the video upload
//         const initResponse = await axios.post(
//             "https://open.tiktokapis.com/v2/post/publish/video/init/",
//             {
//                 post_info: {
//                     title: "My Test Video",
//                     privacy_level: "PUBLIC",
//                     disable_duet: false,
//                     disable_comment: true,
//                     disable_stitch: false,
//                     video_cover_timestamp_ms: 1000,
//                 },
//                 source_info: {
//                     source: "FILE_UPLOAD",
//                     video_size: videoStats.size,
//                     chunk_size: chunkSize,
//                     total_chunk_count: totalChunks,
//                 }
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${accessToken}`,
//                     'Content-Type': 'application/json; charset=UTF-8'
//                 }
//             }
//         );

//         const uploadUrl = initResponse.data.data.upload_url;
//         console.log('Upload URL:', uploadUrl);

//         // Function to upload each chunk
//         const uploadChunk = async (chunkData, chunkIndex) => {
//             const formData = new FormData();
//             formData.append("video_file", chunkData, { filename: `video_chunk_${chunkIndex + 1}.mp4` });

//             try {
//                 const uploadResponse = await axios.post(uploadUrl, formData, {
//                     headers: {
//                         Authorization: `Bearer ${accessToken}`,
//                         'Content-Type': 'multipart/form-data',
//                         ...formData.getHeaders(), // Important for multipart/form-data
//                     }
//                 });
//                 console.log(`Chunk ${chunkIndex + 1} uploaded successfully:`, uploadResponse.data);
//                 return { chunkIndex: chunkIndex + 1, status: 'success', data: uploadResponse.data };
//             } catch (error) {
//                 console.error(`Error uploading chunk ${chunkIndex + 1}:`, error.message);
//                 return { chunkIndex: chunkIndex + 1, status: 'failure', error: error.message };
//             }
//         };

//         // Step 3: Upload video in chunks
//         const videoStream = fs.createReadStream(videoPath, { highWaterMark: chunkSize });
//         let chunkIndex = 0;
//         let uploadResults = [];

//         videoStream.on('data', async (chunk) => {
//             console.log(`Uploading chunk ${chunkIndex + 1}...`);
//             const chunkData = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); // Ensure the chunk is a Buffer
//             const result = await uploadChunk(chunkData, chunkIndex); // Upload each chunk
//             uploadResults.push(result); // Store the result
//             chunkIndex++;
//         });

//         videoStream.on('end', () => {
//             console.log("Video upload completed.");
//             // Step 4: Clean up (delete local file)
//             fs.unlinkSync(videoPath);  // Delete the video from /tmp
//         });

//         videoStream.on('error', (err) => {
//             console.error("Error reading the video file:", err.message);
//         });

//         // Wait for all chunks to be uploaded before returning the result
//         await new Promise((resolve, reject) => {
//             videoStream.on('end', resolve);
//             videoStream.on('error', reject);
//         });

//         // Check if all chunks were uploaded successfully
//         const allChunksUploaded = uploadResults.every(result => result.status === 'success');
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


const uploadVideoToTikTok = async (accessToken) => {
    try {
        const videoPath = path.join(process.cwd(), "video.mp4");
        const fileSize = fs.statSync(videoPath).size;
        const chunkSize = 5 * 1024 * 1024; // 5MB per chunk
        const totalChunks = Math.ceil(fileSize / chunkSize);

        console.log(`📹 Video Size: ${fileSize} bytes`);
        console.log(`📦 Total Chunks: ${totalChunks}`);

        // 1. Request Upload URL
        const uploadUrlRes = await axios.post(
            "https://open.tiktokapis.com/v2/post/publish/video/init/",
            { source_info: { video_type: "video/mp4" } },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (uploadUrlRes.data.error) {
            throw new Error(`Upload Init Failed: ${uploadUrlRes.data.error.message}`);
        }

        const { upload_id, upload_url } = uploadUrlRes.data.data;
        console.log(`✅ Upload ID: ${upload_id}`);

        // 2. Upload Video in Chunks
        const uploadResults = [];
        const videoBuffer = fs.readFileSync(videoPath);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, fileSize);
            const chunk = videoBuffer.slice(start, end);

            console.log(`📤 Uploading Chunk ${i + 1}/${totalChunks}...`);

            try {
                const chunkRes = await axios.post(upload_url, chunk, {
                    headers: { "Content-Type": "video/mp4" },
                });

                if (chunkRes.status === 200) {
                    console.log(`✅ Chunk ${i + 1} uploaded successfully.`);
                    uploadResults.push({ chunkIndex: i + 1, status: "success" });
                } else {
                    console.log(`❌ Chunk ${i + 1} upload failed.`);
                    uploadResults.push({ chunkIndex: i + 1, status: "failure" });
                }
            } catch (error) {
                console.log(`❌ Error uploading chunk ${i + 1}:`, error.message);
                uploadResults.push({ chunkIndex: i + 1, status: "failure" });
            }
        }

        // Check if all chunks were uploaded successfully
        const allUploaded = uploadResults.every((res) => res.status === "success");

        if (!allUploaded) {
            return { success: false, message: "Video upload failed", results: uploadResults };
        }

        console.log("✅ All chunks uploaded successfully!");

        // 3. Complete Upload
        const completeRes = await axios.post(
            "https://open.tiktokapis.com/v2/post/publish/video/complete/",
            { upload_id },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (completeRes.data.error) {
            throw new Error(`Upload Completion Failed: ${completeRes.data.error.message}`);
        }

        console.log("🎉 Video Upload Completed Successfully!");
        return { success: true, message: "Video uploaded successfully" };
    } catch (error) {
        console.error("❌ Error:", error.message);
        return { success: false, message: error.message };
    }
};

// Step 4: Home route for testing
app.use('/', (req, res) => {
    res.send('Welcome to the TikTok OAuth server. Navigate to /oauth to start the login process.');
});
