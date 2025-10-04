import mongoose from "mongoose";

export async function conectarMongoDB() {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI não definida");

  await mongoose.connect(uri, { bufferCommands: false });
  console.log("MongoDB conectado com sucesso");
}
