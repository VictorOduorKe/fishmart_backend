import Client from "ssh2-sftp-client";
import fs from "fs";

export async function uploadToHostPinnacle(localFilePath, remoteFileName) {
  const sftp = new Client();
  try {
    await sftp.connect({
      host: process.env.FTP_HOST,
      port: 22,
      username: process.env.FTP_USER,
      password: process.env.FTP_PASS,
    });

    const remotePath = `/home/yourcpanelusername/public_html/uploads/business/${remoteFileName}`;
    await sftp.fastPut(localFilePath, remotePath);

    console.log(`✅ Uploaded via SFTP: ${remoteFileName}`);
    return `https://fishmartapp.com/uploads/business/${remoteFileName}`;
  } catch (err) {
    console.error("❌ SFTP Upload Error:", err);
    throw err;
  } finally {
    sftp.end();
  }
}
