'use strict';

var helper 			= require('../config/helper'),
	TabelaDePreco 	= require('../models/tabela-preco');

module.exports.addRoutes = function(app) {
	app.post('/helpers/cidades', function(req, res) {
		res.send(helper.cidades(req.body.estado));
    });

	app.post('/helpers/optionsPriceTable', function(req, res) {
		TabelaDePreco.find({ativo: true, tipo: req.body.tipo}, function(err, priceTable) {
			var html = '<option value="">Utilizar tabela padrão</option>';
			if(!err && priceTable)
				for(var i = priceTable.length - 1; i >= 0; i--)
					html += '<option value="'+priceTable[i]._id+'">'+priceTable[i].nome+'</option>';
			res.send(html);
		});
    });

};