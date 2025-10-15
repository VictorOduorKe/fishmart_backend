import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export async function uploadToHostPinnacle(localFilePath, remoteFileName) {
  const formData = new FormData();
  formData.append("file", fs.createReadStream(localFilePath), remoteFileName);

  const response = await axios.post(
    "https://fishmartapp.com/upload.php",
    formData,
    { headers: formData.getHeaders() }
  );

  console.log("✅ Uploaded:", response.data);
  return response.data.url;
}
