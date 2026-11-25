SET TIME ZONE 'America/Costa_Rica';

INSERT INTO permisos (codigo, nombre) VALUES
  ('CREAR','Crear'), ('EDITAR','Editar'), ('BORRAR','Borrar'), ('VER_REPORTES','Ver reportes');

INSERT INTO roles (nombre, descripcion, es_sistema) VALUES
  ('SuperAdmin', 'Administra usuarios, roles, permisos y ve la bitácora', TRUE),
  ('Auditor', 'Solo lectura de usuarios y membresías', TRUE),
  ('Recepción', 'Atiende clientes, membresías y asistencia', TRUE);

-- SuperAdmin y Recepcion tienen los 4 permisos; Auditor ninguno (solo lectura)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.nombre IN ('SuperAdmin', 'Recepción');

-- Usuarios de prueba: admin / Admin#Gym2026, auditor / Auditor#Gym2026, recepcion / Recepcion#Gym2026
INSERT INTO usuarios (username, identificacion, nombre, correo, password_hash, rol_id) VALUES
  ('admin', '1-1111-1111', 'Daniela Administradora', 'admin@kovafit.test',
   '$argon2id$v=19$m=65536,t=3,p=4$fi/62ds3akzofmrRIqUy8w$fGZ2MbA1CNjxHSXuKkNn+inHmwXVRmg2s4RSMvq5eoA',
   (SELECT id FROM roles WHERE nombre = 'SuperAdmin')),
  ('auditor', '2-2222-2222', 'Brandon Auditor', 'auditor@kovafit.test',
   '$argon2id$v=19$m=65536,t=3,p=4$e4Ih0F0d3AiupFgLLxJI6g$DhT37UgFLsw0RxtSew0qp880eu0qLhLe940Te4m/jHA',
   (SELECT id FROM roles WHERE nombre = 'Auditor')),
  ('recepcion', '3-3333-3333', 'Rebeca Recepción', 'recepcion@kovafit.test',
   '$argon2id$v=19$m=65536,t=3,p=4$BiuEPWko8pelxFRkxF3SFQ$QMkWMRZDz8Bm0ZvzFszxN4q68rNCnKGwv0yl17u1ZeU',
   (SELECT id FROM roles WHERE nombre = 'Recepción'));

INSERT INTO clientes (cedula, nombre, telefono, emergencia_nombre, emergencia_telefono) VALUES
  ('2-0701-0101', 'Carlos Vargas Solís', '8800-0001', 'María Solís (madre)', '8800-1001'),
  ('2-0702-0202', 'Laura Jiménez Mora', '8800-0002', 'Pedro Jiménez (padre)', '8800-1002'),
  ('2-0703-0303', 'José Alfaro Quesada', '8800-0003', 'Ana Quesada (esposa)', '8800-1003'),
  ('2-0704-0404', 'Sofía Rojas Araya', '8800-0004', 'Luis Rojas (hermano)', '8800-1004'),
  ('2-0705-0505', 'Diego Méndez Castro', '8800-0005', 'Rosa Castro (madre)', '8800-1005'),
  ('2-0706-0606', 'Valeria Chaves Rodríguez', '8800-0006', 'Jorge Chaves (padre)', '8800-1006'),
  ('2-0707-0707', 'Andrés Murillo Blanco', '8800-0007', 'Elena Blanco (tía)', '8800-1007'),
  ('2-0708-0808', 'Gabriela Herrera Ulate', '8800-0008', 'Mario Herrera (esposo)', '8800-1008');

-- Membresias: vence = inicio + N meses - 1 día
INSERT INTO membresias (codigo, cliente_id, plan, fecha_inicio, fecha_vencimiento, monto, creado_por)
SELECT m.codigo, c.id, m.plan, m.inicio,
       (m.inicio + (CASE m.plan WHEN 'MENSUAL' THEN INTERVAL '1 month' WHEN 'TRIMESTRAL' THEN INTERVAL '3 months' ELSE INTERVAL '12 months' END) - INTERVAL '1 day')::date,
       m.monto, (SELECT id FROM usuarios WHERE username = 'recepcion')
FROM (VALUES
  ('MEM-0001', '2-0701-0101', 'ANUAL', CURRENT_DATE - 30, 250000.00),                                          -- vigente
  ('MEM-0002', '2-0702-0202', 'MENSUAL', (CURRENT_DATE + 3  - INTERVAL '1 month'  + INTERVAL '1 day')::date, 25000.00), -- vence en 3 dias
  ('MEM-0003', '2-0703-0303', 'TRIMESTRAL', (CURRENT_DATE + 6  - INTERVAL '3 months' + INTERVAL '1 day')::date, 65000.00), -- vence en 6 dias
  ('MEM-0004', '2-0704-0404', 'MENSUAL', (CURRENT_DATE - 10 - INTERVAL '1 month'  + INTERVAL '1 day')::date, 25000.00), -- vencida
  ('MEM-0005', '2-0705-0505', 'TRIMESTRAL', CURRENT_DATE - 15, 65000.00),                                          -- vigente
  ('MEM-0006', '2-0706-0606', 'MENSUAL', (CURRENT_DATE - 40 - INTERVAL '1 month'  + INTERVAL '1 day')::date, 25000.00)  -- vencida
) AS m(codigo, cedula, plan, inicio, monto)
JOIN clientes c ON c.cedula = m.cedula;