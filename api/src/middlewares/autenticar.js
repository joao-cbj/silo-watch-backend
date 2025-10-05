import jwt from "jsonwebtoken";

export function autenticar(req, res, next) {
  try {
    // Pegar token do header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: "Token não fornecido" 
      });
    }

    // Formato: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        success: false, 
        error: "Formato de token inválido" 
      });
    }

    const token = parts[1];

    // Verificar token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || "seu_secret_aqui_mude_isso"
    );

    // Anexar usuário na requisição
    req.usuario = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      error: "Token inválido ou expirado" 
    });
  }
}