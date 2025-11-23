export function validarSilo(req, res, next) {
  const { nome, tipoSilo } = req.body;
  
  if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: "Nome do silo é obrigatório" 
    });
  }

  if (!tipoSilo) {
    return res.status(400).json({ 
      success: false, 
      error: "Tipo do silo é obrigatório" 
    });
  }

  const tiposValidos = ['superficie', 'trincheira', 'cilindrico', 'silo-bolsa'];
  if (!tiposValidos.includes(tipoSilo)) {
    return res.status(400).json({
      success: false,
      error: `Tipo do silo inválido. Use: ${tiposValidos.join(', ')}`
    });
  }

  next();
}

export function validarAtualizacaoSilo(req, res, next) {
  // Na atualização, os campos são opcionais
  if (req.body.nome !== undefined && 
      (typeof req.body.nome !== 'string' || req.body.nome.trim().length === 0)) {
    return res.status(400).json({ 
      success: false, 
      error: "Nome do silo inválido" 
    });
  }

  if (req.body.tipoSilo !== undefined) {
    const tiposValidos = ['superficie', 'trincheira', 'cilindrico', 'silo-bolsa'];
    if (!tiposValidos.includes(req.body.tipoSilo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo do silo inválido. Use: ${tiposValidos.join(', ')}`
      });
    }
  }

  next();
}