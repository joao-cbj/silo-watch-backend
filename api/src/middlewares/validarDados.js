export function validarDados(req, res, next) {
  const { temperatura, umidade, dispositivo } = req.body;
  if (temperatura == null || umidade == null || !dispositivo) {
    return res.status(400).json({ success: false, error: "Campos obrigatórios faltando" });
  }
  next();
}
