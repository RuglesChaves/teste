'use strict';

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'log-usuario',
	menu			: 'Logs',
	pageName		: 'Log de usuários',
	pageNamePlural	: 'Log de usuários',
	model 			: 'log-usuario'
});

Controller.customRoutes = function(app) {
	app.get('/'+this.route+'/restore/:id', this.autentication(), this.permission('restore'), this.restore());
}

Controller.restore = function() {
	var LogUsuario = require('../models/'+this.model),
		self = this;

	return function(req, res, next) {
		// console.log('restaurando log');

		LogUsuario.findOne({_id: req.params.id}, function(err, logUsuario) {
			if(err || !logUsuario) {
				req.flash('error','Log não encontrado.');
				res.redirect('/'+self.route);
			} else {
				logUsuario.toObject();
				logUsuario.restaurado = true;

				self.model = logUsuario.model; // define o model como sendo o model do item a ser restaurado para nao quebrar log
				self.pageName = logUsuario['page-name'];

				var Model = require('../models/'+logUsuario.model);

				if(logUsuario.function === 'delete') {
					var	newDocument = new Model(JSON.parse(logUsuario.registro_antigo));
    				newDocument.save(function(err) {
						if(err) {
							req.flash('error','Não foi possível restaurar o registro.');
							res.redirect('/'+self.route);
						} else {
							self.logUsuario(req, 'restore', null, newDocument);
							LogUsuario.findOneAndUpdate({_id: req.params.id}, {$set: {restaurado: true}}, function(err) {
								res.redirect('/'+logUsuario.route);
							});
						}
				    });							
				}

				if(logUsuario.function === 'update') {
					Model.findOne({_id: logUsuario._objeto}, function(err, oldDocument) {
						if(err || !oldDocument) {
							req.flash('error','Não foi possível restaurar o registro.<br />Registro não encontrado.');
							res.redirect('/'+self.route);
						} else
							Model.findOneAndUpdate({_id: logUsuario._objeto}, JSON.parse(logUsuario.registro_antigo), function(err, newDocument) {
								if(err || !newDocument) {
									req.flash('error','Não foi possível restaurar o registro.<br />' + err);
									res.redirect('/'+self.route);
								} else {
									self.logUsuario(req, 'restore', oldDocument, newDocument);
									LogUsuario.findOneAndUpdate({_id: req.params.id}, {$set: {restaurado: true}}, function(err) {
										res.redirect('/'+logUsuario.route);
									});
								}
							});
					});
				}

			}
		});
	}

}

// expose this inherited controller
module.exports = Controller;
