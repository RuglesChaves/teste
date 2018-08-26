'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
	_cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'cliente' },
	_caixa: { type: mongoose.Schema.Types.ObjectId, ref: 'caixa' },
	_pagamento: { type: mongoose.Schema.Types.ObjectId },
	cpf: { type: String	 },
	chave: { type: String },
	descricao: { type: String, uppercase: true },
	numero: { type: Number },
	valor: { type: String },
	valor_impotos: { type: String },
    status: { type: String, uppercase: true },
    observacao: { type: String, uppercase: true },
    data_cadastro: { type: Date, default: Date.now },
    data_envio: { type: Date, default: Date.now },
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('notafiscal', schema);

module.exports = Model;
