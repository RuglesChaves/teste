'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	quantidade_vagas: Number,
	consistencia_entrada_saida: Boolean,
	'gerenciador-ou-tabela': String, //Gerenciador ou Tabela
	tabela: {
		_id: { type: mongoose.Schema.Types.ObjectId, ref: 'tabelaprecos' },
		nome: String,
	},
	gerenciador: {
		_id: { type: mongoose.Schema.Types.ObjectId, ref: 'gerenciadordetabelas' },
		nome: String,
	},
	mensalidade: {
		dia_vencimento: Number,
		data_inicio: Date,
		data_fim: { type: Date, default: null },
		historico: [{
			_pagamento: { type: mongoose.Schema.Types.ObjectId, ref: 'pagamento' },
			_isencao: { type: mongoose.Schema.Types.ObjectId, ref: 'isencao' },
			mes: Number,
			ano: Number,
			dia_vencimento: Number,
			pago: { type: Boolean, default: false },
			isento: { type: Boolean, default: false },
			atrasado: { type: Boolean, default: false },
			valor: String
		}]
	},
	saldo: { type: String, default: '0,00' },
	nome: { type: String, uppercase: true },
    tipo: String,
    categoria: String,
	rg_inscricao: String,
	cpf_cnpj: String,
	razao_social: { type: String, uppercase: true },
	data_nascimento: String,
    data_cadastro: { type: Date, default: Date.now },
	ativo: { type: Boolean },
	nivel: { type: String, default: 'LIVRE', uppercase: true },
	telefone: [String],
    codigos: [String], // talvez limite bastante se usar number
	endereco: [{ 
		nome: { type: String, uppercase: true },
		cep: String,
		endereco: { type: String, uppercase: true },
		numero: String,
		complemento: { type: String, uppercase: true },
		bairro: { type: String, uppercase: true },
		cidade: { type: String, uppercase: true },
		estado: { type: String, uppercase: true }
	}],
	carro: [{
		_id: false,
		placa: { type: String, uppercase: true },
		cor: { type: String, uppercase: true },
		marca: { type: String, uppercase: true },
		modelo: { type: String, uppercase: true }
	}]
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('cliente', schema);

module.exports = Model;