'use strict';

var moment = require('moment');
var async = require('async');
var mongoose = require('mongoose');
var helper = require('../config/helper');
var config = require('../config');

var controller = require('../controllers/controller');

var Controller = new controller({
    route: 'relatorio-isencao',
    menu: 'Relatórios',
    pageName: 'Relatório de Isenção',
    pageNamePlural: 'Relatório de Isenção',
    model: 'isencao'
});

Controller.geraRelatorio = function (req, res, next) {
    var TabelaDePreco = require('../models/tabela-preco'),
        Usuario = require('../models/usuario'),
        Equipamento = require('../models/equipamento'),
        Pagamento = require('../models/pagamento'),
        Isencao = require('../models/isencao'),
        options = req.options,
        self = this;

    req.query.data_inicio = req.query.data_inicio || moment().format('DD/MM/YYYY');
    req.query.data_fim = req.query.data_fim || moment().format('DD/MM/YYYY');


    req.query.tipo = req.query.tipo || 'Mensalidade';

    options.query = req.query;


    var filterIsencao = {
        data_cadastro: {
            '$gte': moment(req.query.data_inicio + ' 00:00', 'DD/MM/YYYY HH:mm').toISOString(),
            '$lte': moment(req.query.data_fim + ' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
        },
        'excluido.data': null
    };

    if (req.query.usuario)
        filterIsencao._usuario = mongoose.Types.ObjectId(req.query.usuario);

    if (req.query.supervisor)
        filterIsencao._usuario_autorizador = mongoose.Types.ObjectId(req.query.supervisor);

    if (req.query.tipo)
        filterIsencao.tipo = req.query.tipo;

    Usuario.find({}, function (err, usuario) {
        if (!err && usuario) {
            options.usuario = usuario;
            options.supervisor = usuario;
        }


        var page = req.query.page || 1;
        Isencao.paginate(filterIsencao, { page: page, limit: 25, sort: { $natural: -1 }, populate: ['_cliente', '_usuario', '_usuario_autorizador'] }, function (err, result) {
            if (!err && result) {

                options.relatorioIsencao = result.docs;

                options.total = Number(result.total);
                options.limit = Number(result.limit);
                options.page = Number(result.page);
                options.pages = Number(result.pages);

                options.pagination = helper.pagination(options);
            }

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
