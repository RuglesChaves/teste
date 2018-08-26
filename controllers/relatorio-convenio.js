'use strict';

var moment = require('moment');
var async = require('async');
var mongoose = require('mongoose');
var helper = require('../config/helper');
var config = require('../config');

var controller = require('../controllers/controller');

var Controller = new controller({
    route: 'relatorio-convenio',
    menu: 'Relatórios',
    pageName: 'Relatório de Convênio',
    pageNamePlural: 'Relatório de Convênio',
    model: 'cartao'
});

Controller.customRoutes = function (app) {
    app.get('/' + this.route + '/print/:id', this.autentication(), this.default(), this.print());
};

Controller.geraRelatorio = function (req, res, next) {
    var Usuario = require('../models/usuario'),
        Cartao = require('../models/cartao'),
        Convenio = require('../models/convenio'),
        options = req.options,
        self = this;

    req.query.data_inicio = req.query.data_inicio || moment().format('DD/MM/YYYY');
    req.query.data_fim = req.query.data_fim || moment().format('DD/MM/YYYY');


    req.query.tipo = req.query.tipo || 'Mensalidade';

    options.query = req.query;


    var filterConvenio = {
        'convenio.data_cadastro': {
            '$gte': moment(req.query.data_inicio + ' 00:00', 'DD/MM/YYYY HH:mm').toISOString(),
            '$lte': moment(req.query.data_fim + ' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
        },
        'excluido.data': null
    };

    if (req.query.usuario)
        filterConvenio['convenio._usuario'] = mongoose.Types.ObjectId(req.query.usuario);

    if (req.query.convenio)
        filterConvenio['convenio._convenio'] = mongoose.Types.ObjectId(req.query.convenio);


    Usuario.find({}, function (err, usuario) {
        if (!err && usuario) {
            options.usuario = usuario;
        }
        
        Convenio.find({}, function(err, convenio){
            if (!err && convenio) {
                options.convenio = convenio;
            }
            
            console.log(filterConvenio);
            var page = req.query.page || 1;
            Cartao.paginate(filterConvenio, { page: page, limit: 25, sort: { $natural: -1 }, populate: ['convenio._tabelapreco', 'convenio._convenio', 'convenio._usuario'] }, function (err, result) {
                if (!err && result) {
    
                    options.relatorioConvenio = result.docs;
    
    
                    options.total = Number(result.total);
                    options.limit = Number(result.limit);
                    options.page = Number(result.page);
                    options.pages = Number(result.pages);
    
                    options.pagination = helper.pagination(options);
                }
    
                res.render(options.route, options);
    
            });
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
