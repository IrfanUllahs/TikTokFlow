import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import { Database, Resource } from "@adminjs/sequelize";
import sequelize from "./database.js"
import User from './User.js'

AdminJS.registerAdapter({ Database, Resource });
console.log(sequelize)
const admin = new AdminJS({
  databases: [User],
  rootPath: "/admin",
});

adminJS.watch()
const adminRouter = AdminJSExpress.buildRouter(admin);

export { admin, adminRouter };
