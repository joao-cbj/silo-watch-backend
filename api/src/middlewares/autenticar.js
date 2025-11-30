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
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET 
    );

    // Padroniza req.usuario com ambos id e _id
    req.usuario = {
      id: decoded._id || decoded.id,     // id aponta para _id
      _id: decoded._id || decoded.id,    // mantém _id original
      email: decoded.email,
      nome: decoded.nome
    };

    console.log('[Auth] ✓ Token válido. Usuário:', req.usuario.id);
    
    next();
  } catch (error) {
    console.error('[Auth] ✗ Erro ao verificar token:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: "Token inválido ou expirado" 
    });
  }
}