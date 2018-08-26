'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    _nivel_acesso: { type: mongoose.Schema.Types.ObjectId, ref: 'nivel-de-acesso' },
    nome: { type: String, uppercase: true },
    login: { type: String, unique: true },
    senha: String,
    grupo: String,
    data_cadastro: { type: Date, default: Date.now },
    status: { type: String, default: 'offline' },
    acesso_externo: { type: Boolean, default: false },
    cep: String,
    rua: String,
    bairro: String,
    numero: String,
    estado: String,
    cidade: String,
    telefone1: String,
    telefone2: String,
    email: { type: String, unique: true },
    foto: { data: Buffer, contentType: String },
    log: [{ 
    	data_cadastro: { type: Date, default: Date.now },
    	route: { type: String },
    	pageName: { type: String },
    	method: { type: String },
    	// registro: { type: mongoose.Schemas.Types.Mixed },
    	// novo_registro: {  }
    	// pageName: { type: String },
    	// pageName: { type: String },
    }]
});
schema.plugin(mongoosePaginate);

// type: mongoose.Schema.Types.Mixed }

var Model = mongoose.model('usuario', schema);

module.exports = Model;
