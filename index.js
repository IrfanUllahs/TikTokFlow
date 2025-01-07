const axios = require("axios");
const querystring = require("querystring");

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
            const userVideosResponse = await axios.get(
                "https://open.tiktokapis.com/v2/video/list/",
                {
                    params: {
                        max_count: 20,
                        fields: "id,title,video_description,duration,cover_image_url,embed_link",
                    },
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            // Combine all data
            const data = {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                scope: response.data.scope,
                user_info: userInfoResponse.data,
                user_videos: userVideosResponse.data,
            };

            console.log("User Info:", data.user_info);
            console.log("User Videos:", data.user_videos);

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
