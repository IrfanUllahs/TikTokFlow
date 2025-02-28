import sequelize from "./database.js"
import { admin, adminRouter } from "./admin.js";
import express from "express";

const app = express();

app.use(express.json());


// app.use(admin.options.rootPath, adminRouter);
app.use('/', (req, res) => {
    res.send('Hello, World!');
})
sequelize
  .sync() // Adjust database schema automatically
  .then(() => console.log("Database connected and synced"))
  .catch((err) => console.error("Database error:", err));

// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}${admin.options.rootPath}`);
});
