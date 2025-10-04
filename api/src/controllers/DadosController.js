import { DadosService } from "../services/DadosService.js";

const service = new DadosService();

export class DadosController {
  static async criar(req, res) {
    try {
      const dados = await service.salvar(req.body);
      res.status(201).json({ success: true, message: "Dados salvos", id: dados._id });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async listar(req, res) {
    try {
      const { limite = 50, dispositivo } = req.query;
      const filtros = dispositivo ? { dispositivo } : {};
      const resultado = await service.buscar(filtros, parseInt(limite));
      res.status(200).json({ success: true, ...resultado });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
