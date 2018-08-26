'use strict';

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({
    categoria: { type: String, uppercase: true },
    descricao: { type: String },
    arquivo: { type: String, uppercase: true },
    ordem: { type: String, uppercase: true }
});
schema.plugin(mongoosePaginate);

var Model = mongoose.model('video', schema);

module.exports = Model;
