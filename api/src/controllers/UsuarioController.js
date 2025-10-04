import { UsuarioService } from "../services/UsuarioService.js";

const usuarioService = new UsuarioService();

export class UsuarioController {
  static async criar(req, res) {
    try {
      const dadosUsuario = req.body;
      const novoUsuario = await usuarioService.criar(dadosUsuario);
      res.status(201).json({ 
        success: true, 
        data: novoUsuario 
      });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  static async listar(req, res) {
    try {
      const usuarios = await usuarioService.listar();
      res.status(200).json({ 
        success: true, 
        data: usuarios 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  static async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const usuario = await usuarioService.buscarPorId(id);
      res.status(200).json({ 
        success: true, 
        data: usuario 
      });
    } catch (error) {
      const statusCode = error.message === "Usuário não encontrado" ? 404 : 500;
      res.status(statusCode).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const dadosParaAtualizar = req.body;
      const usuarioAtualizado = await usuarioService.atualizar(id, dadosParaAtualizar);
      res.status(200).json({ 
        success: true, 
        data: usuarioAtualizado 
      });
    } catch (error) {
      const statusCode = error.message === "Usuário não encontrado" ? 404 : 400;
      res.status(statusCode).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  static async deletar(req, res) {
    try {
      const { id } = req.params;
      await usuarioService.deletar(id);
      res.status(200).json({ 
        success: true, 
        message: "Usuário deletado com sucesso" 
      });
    } catch (error) {
      const statusCode = error.message === "Usuário não encontrado" ? 404 : 500;
      res.status(statusCode).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}