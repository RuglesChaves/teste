'use strict';
var helper			= require('../config/helper');
var mongoose		= require('mongoose');
var moment			= require('moment');
// require default controller
var controller		= require('../controllers/controller');
//require models
var PgtoMassa		= require('../models/pagamento-em-massa');

// creating a new controller object
var Controller = new controller({
	route: 'pagamento-em-massa',
	menu: 'Cadastros',
	pageName: 'Pagamento em Massa',
	pageNamePlural: 'Pagamentos em Massa',
	model: 'pagamento-em-massa'
});

Controller.customRoutes = function (app) {
	app.get('/pagamento-em-massa/print/:id', this.autentication(), this.default(), this.imprimir());
};


Controller.imprimir = function () {
	var self = this;

	return function (req, res, next) { 
        
		PgtoMassa.findOne({ _id: req.params.id }, function (err, result) {
            if(!err && result){
                req.options.result = result;
                console.log(helper.moeda2float(result.valor));
                console.log(result.valor);
                req.options.layout = 'print';
                res.render(self.route+'/printPagamentoEmMassa', req.options);
            }
            
		});

	}
};

module.exports = Controller;