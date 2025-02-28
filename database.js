import { Sequelize } from "sequelize";

// Create a Sequelize instance with MySQL configuration
const sequelize = new Sequelize("testadminjs", "root", "Root@1234", {
    host: "localhost", // Change to your DB host
    dialect: "mysql",
    logging: false, // Set to true if you want to see SQL logs
});

// Test the connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log("✅ Connection has been established successfully.");
    } catch (error) {
        console.error("❌ Unable to connect to the database:", error);
    }
}

testConnection();

export default sequelize;
