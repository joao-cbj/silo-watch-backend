export function validarUsuario(req, res, next) {
  const { nome, email, senha } = req.body;

  // Validar campos obrigatórios
  if (!nome || !email || !senha) {
    return res.status(400).json({
      success: false,
      error: "Nome, email e senha são obrigatórios"
    });
  }

  // Validar tamanho mínimo da senha
  if (senha.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Senha deve ter no mínimo 6 caracteres"
    });
  }

  // Validar formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Email inválido"
    });
  }

  next();
}