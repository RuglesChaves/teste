'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
	_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' },
	_terminal: { type: mongoose.Schema.Types.ObjectId, ref: 'terminal' },
	_objeto: { type: String },
	model: { type: String },
	route: { type: String },
	method: { type: String },
	function: { type: String },
	descricao: { type: String },
	registro_antigo: { type: String },
	registro_novo: { type: String },
	data_hora: { type: Date, default: Date.now },
	ip: { type: String },
	'user-agent': { type: String },
	'page-name': { type: String },
	descricao_detalhada: { type: String },
	restaurado: { type: Boolean, default: false },
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('log-usuario', schema);

module.exports = Model;