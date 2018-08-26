'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    nome: { type: String, uppercase: true },
    numero: Number,
    tipo: [String], // Entrada, Saída
    ip: String,
    mac: String,
    data_cadastro: { type: Date, default: Date.now },
    status: { type: String, default: 'offline' },
    entrada: {
    	_equipamento: { type: String },//type: mongoose.Schema.Types.ObjectId, ref: 'equipamento' }
        rele: Number
    },
    saida: {
		_equipamento: { type: String },//type: mongoose.Schema.Types.ObjectId, ref: 'equipamento' }
        rele: Number
    }
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('terminal', schema);

module.exports = Model;
