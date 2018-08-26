'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	_cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'cliente' },
	nome: String, // nome é codigo(horista) ou nome do cliente(outros casos)
	codigo: String,
	tipo: String, // Credenciado, Horista, Mensalista ou Pre-Pago
	descricao: String,
	sentido: String,
	autorizado: Boolean, // se foi autorizado ou nao
	data_cadastro: { type: Date, default: Date.now },
	_equipamento: { type: mongoose.Schema.Types.ObjectId, ref: 'equipamento' },
	equipamento: {
	    nome: { type: String, uppercase: true },
    	numero: Number
	},
	_terminal: { type: mongoose.Schema.Types.ObjectId, ref: 'terminal' },
	terminal: {
		nome: { type: String, uppercase: true },
		numero: String
	}
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('movimentopatio', schema);

module.exports = Model;
