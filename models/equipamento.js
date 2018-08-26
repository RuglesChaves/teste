'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    nome: { type: String, uppercase: true },
    numero: Number,
    marca: String,
    modelo: String,
    tipo: String, // // Entrada, Saída
    fabricante: String,
    catraca_invertida: Boolean, // Modo catraca invertida
    protocolo: String,
    versao: String,
    ip: String,
    ultima_atividade: { type: Date },
    // mensagens: {
    // 	liberado: {
    // 		mensagem: String,
    // 		duracao: Number
    // 	},
    // 	bloqueado: {
    // 		mensagem: String,
    // 		duracao: Number
    // 	},
    // 	padrao: String
    // },
    comunicacao: {
    	tipo: String, // TCP-IP
    	modo: String, // online / offline / onoff
    	ip: String,
    	porta: Number
    },
    data_cadastro: { type: Date, default: Date.now },
    status: { type: String, default: 'offline' }
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('equipamento', schema);

module.exports = Model;



/*
var schema = new Schema({
  name:    String,
  binary:  Buffer,
  living:  Boolean,
  updated: { type: Date, default: Date.now }
  age:     { type: Number, min: 18, max: 65 }
  mixed:   Schema.Types.Mixed,
  _someId: Schema.Types.ObjectId,
  array:      [],
  ofString:   [String],
  ofNumber:   [Number],
  ofDates:    [Date],
  ofBuffer:   [Buffer],
  ofBoolean:  [Boolean],
  ofMixed:    [Schema.Types.Mixed],
  ofObjectId: [Schema.Types.ObjectId],
  nested: {
    stuff: { type: String, lowercase: true, trim: true }
  }
})
*/
