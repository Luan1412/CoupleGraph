export interface Usuario {
  id: number;
  nome: string;
  email: string;
}

export interface Espaco {
  id: number;
  nome: string;
  criado_por: number;
}

export interface Movimentacao {
  id: number;
  espaco_id: number;
  usuario_id: number;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  created_at: string;
}