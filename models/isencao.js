'use strict'

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var schema = new mongoose.Schema({

    _usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' }, //usuario do caixa
    _usuario_autorizador: { type: mongoose.Schema.Types.ObjectId, ref: 'usuario' }, //usuario que autorizou a isenção
    _caixa: { type: mongoose.Schema.Types.ObjectId, ref: 'caixa' },
    _cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'cliente' },
    _terminal: { type: mongoose.Schema.Types.ObjectId, ref: 'terminal' },
    data_cadastro: Date, //dia em que foi cadastrado a isenção
    tipo: String, //se a isenção é de uma permanência ou mensalidade
    valor: String, //o quanto foi isento
    descricao: String, 
    observacao: String //campo para observação do usuário que autorizou a isenção do pagamento

});

schema.plugin(mongoosePaginate);

var Model = mongoose.model('isencao', schema);

module.exports = Model;