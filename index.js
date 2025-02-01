const express = require('express');
const app = express();
const axios = require('axios');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
const cors = require('cors');
const fs = require("fs");
const path = require("path");
const formData = new FormData();

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
            client_key: "sbaw2jvhniyw1woysb",
            client_secret: "5rwMEGrQbOUucP7MQLjCqqo6p8wGguPs",
            code: decode,
            grant_type: "authorization_code",
            redirect_uri: "https://tik-tok-flow.vercel.app/api/callback",
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

            // Fetch user's videos
            // const userVideosResponse = await axios.get(
            //     "https://open.tiktokapis.com/v2/video/list/",
            //     {
            //         params: {
            //             max_count: 20,
            //             fields: "id,title,video_description,duration,cover_image_url,embed_link",
            //         },
            //         headers: {
            //             Authorization: `Bearer ${accessToken}`,
            //             "Content-Type": "application/json",
            //         },
            //     }
            // );

            const uploadResult = await uploadVideoToTikTok(accessToken);


            // Combine all data
            const data = {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                scope: response.data.scope,
                user_info: userInfoResponse.data,
                upload_result: uploadResult,
                // user_videos: userVideosResponse.data,
            };

            // console.log("User Info:", data.user_info);
            // console.log("User Videos:", data.user_videos);

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
            error,
        });
    }
});



// Function to download and upload video
const uploadVideoToTikTok = async (accessToken) => {
    try {
        // Video URL
        const videoUrl = "https://videos.pexels.com/video-files/8714839/8714839-uhd_2560_1440_25fps.mp4";
        const videoPath = '/tmp/video.mp4';  // Save the video in the /tmp directory

        // Step 1: Download the video
        const response = await axios({
            url: videoUrl,
            method: "GET",
            responseType: "stream",
        });

        // Save the video locally in the /tmp directory
        const writer = fs.createWriteStream(videoPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        console.log("Video downloaded successfully.");

        // Step 2: Split the video into chunks
        const chunkSize = 10000000; // 10MB per chunk
        const videoStats = fs.statSync(videoPath);
        const totalChunks = Math.ceil(videoStats.size / chunkSize); // Total number of chunks

        // Function to upload each chunk
        const uploadChunk = async (chunkData, chunkIndex, totalChunks) => {
            formData.append("video_file", chunkData, { filename: `video_chunk_${chunkIndex + 1}.mp4` });

            const data = {
                post_info: {
                    title: "My Test Video",
                    caption: "This is a test upload via API",
                    privacy_level: "MUTUAL_FOLLOW_FRIENDS",
                    disable_duet: false,
                    disable_comment: true,
                    disable_stitch: false,
                },
                source_info: {
                    source: "FILE_UPLOAD",
                    video_size: videoStats.size,
                    chunk_size: chunkSize,
                    total_chunk_count: totalChunks,
                },
            };

            try {
                const uploadResponse = await axios.post(
                    "https://open.tiktokapis.com/v2/video/upload/",
                    data,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "multipart/form-data",
                        },
                    }
                );
                console.log(`Chunk ${chunkIndex + 1} uploaded successfully:`, uploadResponse.data);
                return uploadResponse.data;
            } catch (error) {
                console.error(`Error uploading chunk ${chunkIndex + 1}:`, error.message);
                return { error: `Chunk ${chunkIndex + 1} upload failed`, details: error.message };
            }
        };

        // Step 3: Upload video in chunks
        const videoStream = fs.createReadStream(videoPath, { highWaterMark: chunkSize });
        let chunkIndex = 0;

        videoStream.on('data', async (chunk) => {
            console.log(`Uploading chunk ${chunkIndex + 1}...`);
            const chunkData = chunk; // Get the chunk data
            await uploadChunk(chunkData, chunkIndex, totalChunks); // Upload each chunk
            chunkIndex++;
        });

        videoStream.on('end', () => {
            console.log("Video upload completed.");
            // Step 4: Clean up (delete local file)
            fs.unlinkSync(videoPath);  // Delete the video from /tmp
        });

        videoStream.on('error', (err) => {
            console.error("Error reading the video file:", err.message);
        });
    } catch (error) {
        console.error("Error uploading video:", error.message);
        return { error: "Video upload failed", details: error };
    }
};




// Step 4: Home route for testing
app.use('/', (req, res) => {
    res.send('Welcome to the TikTok OAuth server. Navigate to /oauth to start the login process.');
});
