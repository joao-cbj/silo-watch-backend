import jwt from "jsonwebtoken";

export function autenticar(req, res, next) {
  try {
    // Pegar token do header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.error('[Auth] Header Authorization não encontrado');
      return res.status(401).json({ 
        success: false, 
        error: "Token não fornecido" 
      });
    }

    // Formato: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.error('[Auth] Formato de token inválido');
      return res.status(401).json({ 
        success: false, 
        error: "Formato de token inválido" 
      });
    }

    const token = parts[1];

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Padroniza req.usuario com todos os campos necessários
    req.usuario = {
      id: decoded._id || decoded.id,
      _id: decoded._id || decoded.id,
      email: decoded.email,
      nome: decoded.nome,
      tipo: decoded.tipo || 'operador' // Fallback para operador se não existir
    };

    console.log('[Auth] ✓ Token válido. Usuário:', req.usuario.id, '- Tipo:', req.usuario.tipo);
    next();
  } catch (error) {
    console.error('[Auth] ✗ Erro ao verificar token:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: "Token inválido ou expirado" 
    });
  }
}