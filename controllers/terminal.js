'use strict';

// require default controller
var controller = require('../controllers/controller');
var Equipamento = require('../models/equipamento');

// creating a new controller object
var Controller = new controller({
	route			: 'terminal',
	menu			: 'Cadastros',
	pageName		: 'Terminal',
	pageNamePlural	: 'Terminais',
	model 			: 'terminal'
});

// override default methods
Controller.validation = function(resource) {
	return function(req, res, next) {
		if(resource === 'create' || resource === 'update') {
			if(!req.body.ip && !req.body.mac) {
				res.json({err: 1, message: 'Você precisa preencher o campo "IP".'});// ou "MAC"
			} else 
				if(!req.body.tipo)
					res.json({err: 1, message: 'Você precisa marcar o campo "Tipo".'});
				else
					next();
		} else
			next();
		
	};
};

Controller.alteraStatus = function(ip, status) {
	var Model = require('../models/'+this.model);
	Model.findOneAndUpdate({ip: ip}, {status: status}, function(err, terminal) {
		// console.log(terminal);
	});
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

		Equipamento.find({/*'tipo':'Entrada'*/}, function(err, entrada) {
			if(!err && entrada)
				req.options.entrada = entrada; 		

			Equipamento.find({/*'tipo':'Saída'*/}, function(err, saida) {
				if(!err && saida)
					req.options.saida = saida; 		

				res.render(self.route + '/show', req.options);
			});
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

				Equipamento.find({/*tipo:'Entrada'*/}, function(err, entrada) {
					if(!err && entrada)
						req.options.entrada = entrada; 		

					Equipamento.find({/*tipo:'Saída'*/}, function(err, saida) {
						if(!err && saida)
							req.options.saida = saida; 		

						res.render(self.route + '/show', req.options);
					});
				});


		  	}
		});
	};
};

// expose this inherited controller
module.exports = Controller;
