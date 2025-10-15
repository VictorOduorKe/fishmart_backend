import ftp from "basic-ftp";
import fs from "fs";
import path from "path";

export async function uploadToHostPinnacle(localFilePath, remoteFileName) {
  const client = new ftp.Client();
  client.ftp.verbose = true; // optional, logs FTP actions

  try {
    await client.access({
      host: process.env.FTP_HOST,     // replace with your HostPinnacle FTP host
      user: process.env.FTP_USER,      // replace with your FTP username
      password: process.env.FTP_PASS,  // replace with your FTP password
      secure: true                     // explicit FTPS
    });

    const remotePath = `/uploads/business/${remoteFileName}`;
    await client.uploadFrom(localFilePath, remotePath);

    console.log(`✅ Uploaded ${localFilePath} to ${remotePath}`);
    return `https://yourdomain.com/uploads/business/${remoteFileName}`;
  } catch (err) {
    console.error("❌ FTP Upload Error:", err);
    throw err;
  } finally {
    client.close();
  }
}
