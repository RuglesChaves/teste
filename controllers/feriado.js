'use strict';
var helper = require('../config/helper');
var mongoose = require('mongoose');
var moment = require('moment');
// require default controller
var controller = require('../controllers/controller');


// creating a new controller object
var Controller = new controller({
	route: 'feriado',
	menu: 'Feriados',
	pageName: 'Feriado',
	pageNamePlural: 'Feriados',
	model: 'feriado'
});


Controller.create = function() {
    var Model = require('../models/'+this.model),
        self  = this;

    return function(req, res, next) {
     
        new Model({
            nome: req.body.nome,
            'atualizado-por': req.session.login.nome,
            cadastro: new Date(),
            'data-feriado': moment(req.body['data-feriado'], 'DD/MM/YYYY').toDate(),
            'repetir-todo-ano': req.body['repetir-todo-ano']? true : false  
        }).save(function(err, feriado) {
            if(err)
                res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
            else  {
                self.logUsuario(req, 'create', null, feriado);
                res.json({err: 0, redirect: '/'+self.route});
            }
        });
    };
},
Controller.update = function() {
    var Model = require('../models/'+this.model),
        self  = this;

    return function(req, res, next) {

        Model.findOne({_id: req.body.id}, function(err, oldDocument) {
            if(err || !oldDocument)
                res.json({err: 1, message: 'Não foi possível realizar a operação.<br />Registro não encontrado.'});
            else{
                
                var feriado = {
                    _id: req.body.id,
                    nome: req.body.nome,
                    'atualizado-por': req.session.login.nome,
                    cadastro: new Date(),
                    'data-feriado': moment(req.body['data-feriado'], 'DD/MM/YYYY').toDate(),
                    'repetir-todo-ano': req.body['repetir-todo-ano']? true : false  
                }

                Model.findOneAndUpdate({_id: req.body.id}, feriado, function(err, newDocument) {
                    if(err || !newDocument)
                        res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
                    else {
                        self.logUsuario(req, 'update', oldDocument, newDocument);
                        res.json({err: 0, redirect: '/'+self.route});
                    }
                });
            }
        });
    };
}


// expose this inherited controller
module.exports = Controller;