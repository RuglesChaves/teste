'use strict';

var controller = require('../controllers/controller');

var Controller = new controller({
	route			: 'perfil',
	menu			: '',
	pageName		: 'Perfil',
	pageNamePlural	: '',
	model  			: 'usuario'
});

Controller.edit = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		req.options.isEdit = true;
		req.options.action = 'Alterar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb = [
			{ 
			  'route': '/inicio',
			  'pageName': 'Início'
			},
			{ 'route': '/'+self.route,
			  'pageName': self.pageName }
		];

		Model.findOne({_id: req.params.id}, function(err, result) {
			if(err || !result) {
				req.flash('error','Registro não encontrado.');
				res.redirect('/inicio');
			} else {
	  	  		req.options.result = result;
				res.render(self.route + '/show', req.options);
		  	}
		});
	};
};

Controller.update = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		Model.findOne({_id: req.body.id}, function(err, oldDocument) {
			if(err || !oldDocument)
				res.json({err: 1, message: 'Não foi possível realizar a operação.<br />Registro não encontrado.'});
			else
				Model.findOneAndUpdate({_id: req.body.id}, req.body, function(err, newDocument) {
					if(err){
						res.json({err: 1, message: 'Não foi possível realizar a operação.<br />' + err});
					} else {
						self.logUsuario(req, 'update', oldDocument, newDocument);
						res.json({err: 0, message: 'Perfil atualizado com sucesso.'});
					}
				});
		});
	};
};

// expose this inherited controller
module.exports = Controller;
