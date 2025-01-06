const express = require('express');
const app = express();
const axios = require('axios');
const cookieParser = require('cookie-parser');
const cors = require('cors');
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
    url += '&scope=user.info.basic';
    url += '&response_type=code';
    url += `&redirect_uri=${encodeURIComponent(SERVER_ENDPOINT_REDIRECT)}`;
    url += `&state=${csrfState}`;

    res.redirect(url);
});

// // Step 2: Handle the callback from TikTok
// app.get('/api/callback', async (req, res) => {
//     const { code, state } = req.query;
//     const csrfState = req.cookies.csrfState;

//     if (!state || state !== csrfState) {
//         return res.status(400).send('CSRF validation failed');
//     }

//     if (!code) {
//         return res.status(400).send('Authorization code not provided');
//     }

//     try {
//         // Exchange code for access token
//         const tokenUrl = 'https://open-api.tiktokglobalplatform.com/v2/oauth/token';
//         const tokenResponse = await axios.post(
//             tokenUrl,
//             new URLSearchParams({
//                 client_key: "sbaw2jvhniyw1woysb",
//                 client_secret: "5rwMEGrQbOUucP7MQLjCqqo6p8wGguPs",
//                 code,
//                 grant_type: 'authorization_code',
//                 redirect_uri: "https://tik-tok-flow.vercel.app/api/callback",
//             }).toString(),
//             {
//                 headers: {
//                     'Content-Type': 'application/x-www-form-urlencoded',
//                 },
//             }
//         );

//         const tokenData = tokenResponse.data;

//         if (tokenData.error) {
//             return res.status(400).json({ error: tokenData.error });
//         }

//         // Step 3: Use the access token to get user info
//         const userInfoUrl = 'https://open-api.tiktokglobalplatform.com/v2/user/info';
//         const userInfoResponse = await axios.get(userInfoUrl, {
//             headers: {
//                 Authorization: `Bearer ${tokenData.access_token}`,
//             },
//         });

//         const userInfo = userInfoResponse.data;
//         res.json(userInfo); // Send user info back as JSON
//     } catch (error) {
//         console.error('Error during TikTok OAuth process:', error.message);
//         res.status(500).send({
//             error: 'An error occurred during TikTok OAuth process',
//             errorDetails: error.message,
//             error
//         });
//     }
// });

app.get("/api/callback", async (req, res) => {
    try {
        const { code } = req.body;
        const decode = decodeURI(code);
        const tokenEndpoint = "https://open.tiktokapis.com/v2/oauth/token/";
        const params = {
            client_key: "sbaw2jvhniyw1woysb",
            client_secret: "5rwMEGrQbOUucP7MQLjCqqo6p8wGguPs",
            code: decode,
            grant_type: "authorization_code",
            redirect_uri:
                "https://tik-tok-flow.vercel.app/api/callback",
        };
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
        console.log("response>>>>>>>", response.data);
        res.send(response.data);
    } catch (error) {
        console.error("Error during callback:", error.message);
        res.status(500).send({
            error: "An error occurred during callback",
            errorDetails: error.message,
            error
        });
    }
});

// Step 4: Home route for testing
app.use('/', (req, res) => {
    res.send('Welcome to the TikTok OAuth server. Navigate to /oauth to start the login process.');
});
