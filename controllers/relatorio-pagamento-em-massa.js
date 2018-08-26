'use strict';

var moment = require('moment');
var async = require('async');
var mongoose = require('mongoose');
var helper = require('../config/helper');
var config = require('../config');

var controller = require('../controllers/controller');

var Controller = new controller({
    route: 'relatorio-pagamento-em-massa',
    menu: 'Relatórios',
    pageName: 'Relatório de Pagamento em Massa',
    pageNamePlural: 'Relatório de Pagamento em Massa',
    model: 'pagamento-em-massa'
});

Controller.geraRelatorio = function (req, res, next) {
    var TabelaDePreco = require('../models/tabela-preco'),
        Usuario = require('../models/usuario'),
        PagamentoEmMassa = require('../models/pagamento-em-massa'),
        options = req.options,
        self = this;

    req.query.data_inicio = req.query.data_inicio || moment().format('DD/MM/YYYY');
    req.query.data_fim = req.query.data_fim || moment().format('DD/MM/YYYY');

    options.query = req.query;

    var filterPagamento = {
        cadastro: {
            '$gte': moment(req.query.data_inicio + ' 00:00', 'DD/MM/YYYY HH:mm').toISOString(),
            '$lte': moment(req.query.data_fim + ' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
        }
    };

    if (req.query.usuario) {
        if (req.query.usuario !== 'nenhum')
            filterPagamento._usuario = mongoose.Types.ObjectId(req.query.usuario);
        else
            filterPagamento._usuario = { $exists: false };
    }

    if (req.query.forma_pagamento)
        filterPagamento.forma_pagamento = req.query.forma_pagamento;

    Usuario.find({}, function (err, usuario) {
        if (!err && usuario) {
            options.usuario = usuario;
            options.query.nome_usuario = usuario.filter(function (elem) { return elem._id == req.query.usuario });
        }

        options.forma_pagamento = {
            Dinheiro: {
                total: 0,
                quantidade: 0
            },
            'Cartão de Crédito': {
                total: 0,
                quantidade: 0
            },
            'Cartão de Débito': {
                total: 0,
                quantidade: 0
            }
        };

        TabelaDePreco.find({ ativo: true, tipo: 'Permanência' }, null, { sort: { nome: 1 } }).exec(function (err, tabelaDePreco) {
            options.tabela_de_preco = {};
            if (!err && tabelaDePreco) {
                for (var i = 0; i < tabelaDePreco.length; i++) {
                    options.tabela_de_preco[tabelaDePreco[i]._id] = {
                        nome: tabelaDePreco[i].nome,
                        total: 0,
                        quantidade: 0
                    }
                }
                
                PagamentoEmMassa.find(filterPagamento, function (err, pagamentos) {
                    if (pagamentos && !err) {

                        var page = req.query.page || 1;
                        PagamentoEmMassa.paginate(filterPagamento, { page: page, limit: 25, sort: { $natural: -1 } }, function (err, result) {
                            if (!err && result) {
                                options.pagamentosPaginados  = result.docs;
                                options.total       = Number(result.total);
                                options.limit       = Number(result.limit);
                                options.page        = Number(result.page);
                                options.pages       = Number(result.pages);
                                options.pagination  = helper.pagination(options);
                            }
                          


                            async.forEachOf(pagamentos, function (pagamento, index, callback) {

                                if (pagamento.valor && pagamento.forma_pagamento) {
                                    
                                    if (options.forma_pagamento[pagamento.forma_pagamento]) {
                                        options.forma_pagamento[pagamento.forma_pagamento].total += helper.moeda2float(pagamento.total);
                                        options.forma_pagamento[pagamento.forma_pagamento].quantidade++;
                                    }
                                   

                                    if (pagamento['_tabela-de-preco'] && pagamento['_tabela-de-preco']._id) {
                                        if (options.tabela_de_preco[pagamento['_tabela-de-preco']._id]) {
                                            options.tabela_de_preco[pagamento['_tabela-de-preco']._id].total += helper.moeda2float(pagamento.total);
                                            options.tabela_de_preco[pagamento['_tabela-de-preco']._id].quantidade++;
                                        } else {
                                            options.tabela_de_preco[pagamento['_tabela-de-preco']._id] = {
                                                nome: pagamento['_tabela-de-preco'].nome,
                                                total: helper.moeda2float(pagamento.total),
                                                quantidade: 1
                                            }
                                        }
                                    }

                                }

                                callback();

                            }, function (err) {
                                res.render(options.route, options);
                            });

                        });

                    }

                });

            } else
                res.render(options.route, options);

        });



    });

};

Controller.print = function () {
    var self = this;

    return function (req, res, next) {
        req.options.route = self.route + '/print';
        req.options.layout = 'print';

        if (req.query.printComPopup)
            req.options.printComPopup = true;

        if (req.query.pdf)
            req.options.pdf = true;

        self.geraRelatorio(req, res, next);
    };
};

Controller.read = function () {
    var self = this;

    return function (req, res, next) {
        req.options.printUrl = req.url.replace(self.route, self.route + '/print/');
        self.geraRelatorio(req, res, next);
    };
};

// expose this inherited controller
module.exports = Controller;
