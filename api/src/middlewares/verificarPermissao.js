import Usuario from "../models/Usuario.js";

/**
 * Middleware para verificar se usuário é Admin
 */
export async function verificarAdmin(req, res, next) {
  try {
    const usuarioId = req.usuario._id || req.usuario.id;
    
    const usuario = await Usuario.findById(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado"
      });
    }
    
    if (usuario.tipo !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "Acesso negado. Apenas administradores podem realizar esta ação."
      });
    }
    
    // Adiciona informações completas do usuário na requisição
    req.usuarioCompleto = usuario;
    next();
  } catch (error) {
    console.error('[Permissão] Erro ao verificar permissão:', error);
    return res.status(500).json({
      success: false,
      error: "Erro ao verificar permissões"
    });
  }
}

/**
 * Middleware para verificar se usuário pode gerenciar outro usuário
 * Admin: pode gerenciar qualquer usuário
 * Operador: pode gerenciar apenas a si mesmo
 */
export async function verificarGerenciarUsuario(req, res, next) {
  try {
    const usuarioLogadoId = req.usuario._id || req.usuario.id;
    const usuarioAlvoId = req.params.id;
    
    const usuarioLogado = await Usuario.findById(usuarioLogadoId);
    
    if (!usuarioLogado) {
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado"
      });
    }
    
    // Admin pode gerenciar qualquer usuário
    if (usuarioLogado.tipo === 'admin') {
      req.usuarioCompleto = usuarioLogado;
      return next();
    }
    
    // Operador só pode gerenciar a si mesmo
    if (usuarioLogadoId.toString() !== usuarioAlvoId.toString()) {
      return res.status(403).json({
        success: false,
        error: "Você não tem permissão para gerenciar este usuário"
      });
    }
    
    req.usuarioCompleto = usuarioLogado;
    next();
  } catch (error) {
    console.error('[Permissão] Erro ao verificar gerenciamento:', error);
    return res.status(500).json({
      success: false,
      error: "Erro ao verificar permissões"
    });
  }
}