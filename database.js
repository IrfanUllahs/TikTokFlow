import { Sequelize } from "sequelize";

// Create a Sequelize instance with MySQL configuration
const sequelize = new Sequelize("defaultdb", "avnadmin", "AVNS_QC5w0r1TCoQZEFmNix7", {
    host: "mysql-33e8b62d-khange221133-a201.l.aivencloud.com",
    port: 27627, // Add the correct port
    dialect: "mysql",
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false, // Important if using a self-signed certificate
        },
    },
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
