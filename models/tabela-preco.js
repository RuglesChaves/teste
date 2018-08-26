'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	nome: { type: String, uppercase: true },
	tipo: String,
	ativo: { type: Boolean },
	acesso_unico: { type: Boolean },
	padrao: { type: Boolean },
	tolerancia_saida: String,
	tolerancia_entrada: String,
	xxx: String,
	permanencias: [{
		_id: false,
		hora: String,
		valor: String,
	}],
	dias: [{
		_id: false,
		quantidade: String,
		valor: String,
	}],
	mensalidade: {
		valor: String,
		vencimento: Number,
		bloquear_inadimplente: Boolean,
		tolerancia: Number
	},
	preco_fixo: {
		hora: String,
		dia: String,
		valor: String
	},
    data_cadastro: { type: Date, default: Date.now }
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('tabelaprecos', schema);

module.exports = Model;
