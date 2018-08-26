'use strict';

var helper = require('../config/helper');
var controller = require('../controllers/controller');
var NivelDeAcesso = require('../models/nivel-de-acesso');

var Controller = new controller({
	route			: 'usuario',
	menu			: 'Configuração',
	pageName		: 'Usuário',
	pageNamePlural	: 'Usuários',
	model  			: 'usuario'
});

Controller.read = function() {
	var Model  = require('../models/'+this.model),
		self   = this;

	return function(req, res, next) {
		// Model.find().sort({$natural: -1}).exec(function(err, result) {
		var page = req.query.page || 1;
		Model.paginate({}, {page: page, limit: 25, sort: {$natural: -1}, populate: '_nivel_acesso'}, function(err, result) {
			if(!err && result) {
				req.options.result = result.docs;
				// console.log(req.options.result);
				req.options.total = Number(result.total);
				req.options.limit = Number(result.limit);
				req.options.page = Number(result.page);
				req.options.pages = Number(result.pages);

				req.options.pagination = helper.pagination(req.options);
			}

			res.render(self.route, req.options);
		});
	};
};

Controller.new = function() {
	var self = this;

	return function(req, res, next) {
		req.options.isEdit = false;
		req.options.action = 'Cadastrar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({ 
			'route': '/'+self.route+'/cadastrar',
			'pageName': req.options.title });

		NivelDeAcesso.find({}, function(err, resultNivelDeAcesso) {
			req.options.nivelDeAcesso = resultNivelDeAcesso;

			res.render(self.route + '/show', req.options);
		});
	};
};

Controller.edit = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		req.options.isEdit = true;
		req.options.action = 'Alterar';
		
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({ 
			route: '/'+self.route+'/'+req.params.id,
			pageName: req.options.title
		});
		Model.findOne({_id: req.params.id}, function(err, result) {
			if(err || !result) {
				req.flash('error','Registro não encontrado.');
				res.redirect('/'+self.route);
			} else {
	  	  		req.options.result = result;
	  	  		NivelDeAcesso.find({}, function(err, resultNivelDeAcesso) {
					req.options.nivelDeAcesso = resultNivelDeAcesso; 
					res.render(self.route + '/show', req.options);
				});
		  	}
		});
	};
};

// expose this inherited controller
module.exports = Controller;
