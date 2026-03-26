// Realistiske demo-data for en dansk WooCommerce webshop

function dage(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const demoOrders = [
  { id:1001, customer_id:1, total:"549.00", date_created: dage(2),  line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:2,total:"298.00"},{product_id:20,name:"Kaffekværn Pro",quantity:1,total:"251.00"}] },
  { id:1002, customer_id:2, total:"1299.00",date_created: dage(3),  line_items:[{product_id:30,name:"Espressomaskine Deluxe",quantity:1,total:"1299.00"}] },
  { id:1003, customer_id:3, total:"249.00", date_created: dage(4),  line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:3,total:"249.00"}] },
  { id:1004, customer_id:4, total:"799.00", date_created: dage(5),  line_items:[{product_id:40,name:"Pour Over Sæt",quantity:1,total:"449.00"},{product_id:10,name:"Økologisk Kaffe 500g",quantity:2,total:"350.00"}] },
  { id:1005, customer_id:5, total:"349.00", date_created: dage(6),  line_items:[{product_id:50,name:"Kaffebønner Etiopien 1kg",quantity:1,total:"349.00"}] },
  { id:1006, customer_id:1, total:"299.00", date_created: dage(8),  line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:2,total:"199.00"},{product_id:60,name:"Mælkeskummer",quantity:1,total:"100.00"}] },
  { id:1007, customer_id:6, total:"1850.00",date_created: dage(9),  line_items:[{product_id:30,name:"Espressomaskine Deluxe",quantity:1,total:"1299.00"},{product_id:20,name:"Kaffekværn Pro",quantity:1,total:"551.00"}] },
  { id:1008, customer_id:7, total:"149.00", date_created: dage(10), line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:1,total:"149.00"}] },
  { id:1009, customer_id:8, total:"599.00", date_created: dage(11), line_items:[{product_id:40,name:"Pour Over Sæt",quantity:1,total:"449.00"},{product_id:60,name:"Mælkeskummer",quantity:1,total:"150.00"}] },
  { id:1010, customer_id:9, total:"2199.00",date_created: dage(12), line_items:[{product_id:70,name:"Baristakit Komplet",quantity:1,total:"2199.00"}] },
  { id:1011, customer_id:10,total:"449.00", date_created: dage(13), line_items:[{product_id:50,name:"Kaffebønner Etiopien 1kg",quantity:1,total:"349.00"},{product_id:60,name:"Mælkeskummer",quantity:1,total:"100.00"}] },
  { id:1012, customer_id:2, total:"299.00", date_created: dage(14), line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:2,total:"299.00"}] },
  { id:1013, customer_id:11,total:"749.00", date_created: dage(15), line_items:[{product_id:80,name:"Kold Brygger Set",quantity:1,total:"749.00"}] },
  { id:1014, customer_id:12,total:"199.00", date_created: dage(16), line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:1,total:"149.00"},{product_id:90,name:"Kaffe Tilbehørspakke",quantity:1,total:"50.00"}] },
  { id:1015, customer_id:3, total:"1299.00",date_created: dage(17), line_items:[{product_id:30,name:"Espressomaskine Deluxe",quantity:1,total:"1299.00"}] },
  { id:1016, customer_id:13,total:"649.00", date_created: dage(18), line_items:[{product_id:20,name:"Kaffekværn Pro",quantity:1,total:"649.00"}] },
  { id:1017, customer_id:14,total:"299.00", date_created: dage(19), line_items:[{product_id:50,name:"Kaffebønner Etiopien 1kg",quantity:1,total:"299.00"}] },
  { id:1018, customer_id:5, total:"449.00", date_created: dage(20), line_items:[{product_id:40,name:"Pour Over Sæt",quantity:1,total:"449.00"}] },
  { id:1019, customer_id:15,total:"199.00", date_created: dage(21), line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:1,total:"199.00"}] },
  { id:1020, customer_id:16,total:"899.00", date_created: dage(22), line_items:[{product_id:80,name:"Kold Brygger Set",quantity:1,total:"749.00"},{product_id:60,name:"Mælkeskummer",quantity:1,total:"150.00"}] },
  // Lidt ældre (til prognose + sæsonsammenligning)
  { id:901, customer_id:4, total:"499.00", date_created: dage(40), line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:2,total:"299.00"},{product_id:60,name:"Mælkeskummer",quantity:1,total:"200.00"}] },
  { id:902, customer_id:6, total:"1299.00",date_created: dage(45), line_items:[{product_id:30,name:"Espressomaskine Deluxe",quantity:1,total:"1299.00"}] },
  { id:903, customer_id:7, total:"349.00", date_created: dage(50), line_items:[{product_id:50,name:"Kaffebønner Etiopien 1kg",quantity:1,total:"349.00"}] },
  { id:904, customer_id:8, total:"749.00", date_created: dage(55), line_items:[{product_id:80,name:"Kold Brygger Set",quantity:1,total:"749.00"}] },
  { id:905, customer_id:9, total:"649.00", date_created: dage(60), line_items:[{product_id:20,name:"Kaffekværn Pro",quantity:1,total:"649.00"}] },
  { id:801, customer_id:1, total:"299.00", date_created: dage(370),line_items:[{product_id:10,name:"Økologisk Kaffe 500g",quantity:2,total:"299.00"}] },
  { id:802, customer_id:2, total:"1299.00",date_created: dage(375),line_items:[{product_id:30,name:"Espressomaskine Deluxe",quantity:1,total:"1299.00"}] },
  { id:803, customer_id:3, total:"449.00", date_created: dage(380),line_items:[{product_id:40,name:"Pour Over Sæt",quantity:1,total:"449.00"}] },
  { id:804, customer_id:5, total:"349.00", date_created: dage(385),line_items:[{product_id:50,name:"Kaffebønner Etiopien 1kg",quantity:1,total:"349.00"}] },
  { id:805, customer_id:10,total:"2199.00",date_created: dage(390),line_items:[{product_id:70,name:"Baristakit Komplet",quantity:1,total:"2199.00"}] },
];

export const demoCustomers = [
  { id:1,  first_name:"Anders",  last_name:"Nielsen",   email:"anders@example.dk",  date_created: dage(400) },
  { id:2,  first_name:"Mette",   last_name:"Hansen",    email:"mette@example.dk",   date_created: dage(380) },
  { id:3,  first_name:"Lars",    last_name:"Pedersen",  email:"lars@example.dk",    date_created: dage(360) },
  { id:4,  first_name:"Sofie",   last_name:"Christensen",email:"sofie@example.dk",  date_created: dage(340) },
  { id:5,  first_name:"Thomas",  last_name:"Jensen",    email:"thomas@example.dk",  date_created: dage(320) },
  { id:6,  first_name:"Camilla", last_name:"Møller",    email:"camilla@example.dk", date_created: dage(300) },
  { id:7,  first_name:"Mikkel",  last_name:"Larsen",    email:"mikkel@example.dk",  date_created: dage(280) },
  { id:8,  first_name:"Louise",  last_name:"Andersen",  email:"louise@example.dk",  date_created: dage(60)  },
  { id:9,  first_name:"Rasmus",  last_name:"Madsen",    email:"rasmus@example.dk",  date_created: dage(55)  },
  { id:10, first_name:"Julie",   last_name:"Kristensen",email:"julie@example.dk",   date_created: dage(50)  },
  { id:11, first_name:"Simon",   last_name:"Thomsen",   email:"simon@example.dk",   date_created: dage(20)  },
  { id:12, first_name:"Ida",     last_name:"Rasmussen", email:"ida@example.dk",     date_created: dage(18)  },
  { id:13, first_name:"Kasper",  last_name:"Olsen",     email:"kasper@example.dk",  date_created: dage(15)  },
  { id:14, first_name:"Maria",   last_name:"Sørensen",  email:"maria@example.dk",   date_created: dage(10)  },
  { id:15, first_name:"Frederik",last_name:"Johansen",  email:"frederik@example.dk",date_created: dage(7)   },
  { id:16, first_name:"Emma",    last_name:"Lund",      email:"emma@example.dk",    date_created: dage(3)   },
];

export const demoForladteKurve = [
  { id:"fc1", email:"peter@example.dk",  navn:"Peter Dahl",    total:"549.00",  produkter:["Kaffekværn Pro"],           tid: dage(1) },
  { id:"fc2", email:"nina@example.dk",   navn:"Nina Holm",     total:"1299.00", produkter:["Espressomaskine Deluxe"],   tid: dage(2) },
  { id:"fc3", email:"henrik@example.dk", navn:"Henrik Storm",  total:"299.00",  produkter:["Økologisk Kaffe 500g x2"],  tid: dage(3) },
  { id:"fc4", email:"anna@example.dk",   navn:"Anna Dalgaard", total:"749.00",  produkter:["Kold Brygger Set"],         tid: dage(4) },
];
