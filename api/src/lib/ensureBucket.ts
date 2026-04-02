import { ensureBucket } from "./storage.js";

ensureBucket()
  .then(() => console.log("S3 bucket ready"))
  .catch((err) => console.warn("S3 bucket check failed (storage may be unavailable):", err.message));
