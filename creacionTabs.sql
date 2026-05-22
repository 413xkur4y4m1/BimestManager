use labs

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol ENUM('ADMIN','MAESTRO','ALUMNO') NOT NULL,
  grupo_id INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL
);

ALTER TABLE usuarios
ADD CONSTRAINT fk_usuario_grupo
FOREIGN KEY (grupo_id) REFERENCES grupos(id)
ON DELETE SET NULL;

CREATE TABLE materiales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  stock INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE practicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  practica_id INT NOT NULL,
  nombre VARCHAR(100),
  FOREIGN KEY (practica_id) REFERENCES practicas(id)
    ON DELETE CASCADE
);

CREATE TABLE kit_materiales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kit_id INT NOT NULL,
  material_id INT NOT NULL,
  cantidad INT NOT NULL,
  FOREIGN KEY (kit_id) REFERENCES kits(id)
    ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materiales(id)
    ON DELETE RESTRICT
);



CREATE TABLE sesiones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  practica_id INT NOT NULL,
  maestro_id INT NOT NULL,
  grupo_id INT NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME,
  duracion_min INT,
  num_equipos INT,
  integrantes_por_equipo INT,
  estado ENUM('PROGRAMADA','EN_CURSO','FINALIZADA') DEFAULT 'PROGRAMADA',
  FOREIGN KEY (practica_id) REFERENCES practicas(id),
  FOREIGN KEY (maestro_id) REFERENCES usuarios(id),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

CREATE TABLE equipos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sesion_id INT NOT NULL,
  nombre VARCHAR(50),
  FOREIGN KEY (sesion_id) REFERENCES sesiones(id)
    ON DELETE CASCADE
);

CREATE TABLE equipo_integrantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipo_id INT NOT NULL,
  usuario_id INT NOT NULL,
  FOREIGN KEY (equipo_id) REFERENCES equipos(id)
    ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
);

CREATE TABLE responsivas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sesion_id INT NOT NULL,
  equipo_id INT NOT NULL,
  estado ENUM('ACTIVA','FINALIZADA') DEFAULT 'ACTIVA',
  FOREIGN KEY (sesion_id) REFERENCES sesiones(id),
  FOREIGN KEY (equipo_id) REFERENCES equipos(id)
);

CREATE TABLE incidencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sesion_id INT NOT NULL,
  equipo_id INT NOT NULL,
  material_id INT NOT NULL,
  tipo ENUM('ROTO','PERDIDO') NOT NULL,
  descripcion TEXT,
  responsable_usuario_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sesion_id) REFERENCES sesiones(id),
  FOREIGN KEY (equipo_id) REFERENCES equipos(id),
  FOREIGN KEY (material_id) REFERENCES materiales(id),
  FOREIGN KEY (responsable_usuario_id) REFERENCES usuarios(id)
);


CREATE TABLE adeudos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  material_id INT NOT NULL,
  incidencia_id INT,
  estado ENUM('PENDIENTE','RESUELTO') DEFAULT 'PENDIENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (material_id) REFERENCES materiales(id),
  FOREIGN KEY (incidencia_id) REFERENCES incidencias(id)
);

CREATE TABLE notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE
);


CREATE TABLE prestamos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  material_id INT NOT NULL,
  cantidad INT NOT NULL,
  fecha_prestamo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion TIMESTAMP NULL,
  estado ENUM('ACTIVO','DEVUELTO') DEFAULT 'ACTIVO',
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (material_id) REFERENCES materiales(id)
);

ALTER TABLE practicas
ADD COLUMN tipo ENUM('QUIMICA','TURISMO') NOT NULL;

CREATE TABLE usuarios_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,

  rol ENUM('ADMIN','ALUMNO') NOT NULL,

  grupo VARCHAR(50),

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE practicas_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,

  duracion_minutos INT,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);








CREATE TABLE materiales_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  nombre VARCHAR(100) NOT NULL,

  stock INT NOT NULL DEFAULT 0,

  estado ENUM(
    'DISPONIBLE',
    'DAÑADO'
  ) DEFAULT 'DISPONIBLE',

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);




CREATE TABLE sugerencias_material_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  practica_id INT NOT NULL,
  material_id INT NOT NULL,

  cantidad_sugerida INT DEFAULT 1,

  FOREIGN KEY (practica_id)
    REFERENCES practicas_turismo(id),

  FOREIGN KEY (material_id)
    REFERENCES materiales_turismo(id)
);

CREATE TABLE sesiones_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  practica_id INT NOT NULL,

  grupo VARCHAR(50) NOT NULL,

  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NOT NULL,

  estado ENUM(
    'PROGRAMADA',
    'EN_CURSO',
    'FINALIZADA'
  ) DEFAULT 'PROGRAMADA',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (practica_id)
    REFERENCES practicas_turismo(id)
);

CREATE TABLE prestamos_material_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  sesion_id INT NOT NULL,

  alumno_id INT NOT NULL,

  material_id INT NOT NULL,

  cantidad INT NOT NULL,

  estado ENUM(
    'PRESTADO',
    'DEVUELTO',
    'PENDIENTE',
    'ADEUDO'
  ) DEFAULT 'PRESTADO',

  fecha_prestamo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  fecha_devolucion DATETIME NULL,

  FOREIGN KEY (sesion_id)
    REFERENCES sesiones_turismo(id),

  FOREIGN KEY (alumno_id)
    REFERENCES usuarios_turismo(id),

  FOREIGN KEY (material_id)
    REFERENCES materiales_turismo(id)
);



CREATE TABLE incidencias_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  prestamo_id INT NOT NULL,

  descripcion TEXT,

  tipo ENUM(
    'ROTO',
    'PERDIDO'
  ) NOT NULL,

  estado ENUM(
    'PENDIENTE',
    'RESUELTO'
  ) DEFAULT 'PENDIENTE',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (prestamo_id)
    REFERENCES prestamos_material_turismo(id)
);


CREATE TABLE notificaciones_turismo (
  id INT AUTO_INCREMENT PRIMARY KEY,

  usuario_id INT NOT NULL,

  mensaje TEXT NOT NULL,

  leido BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (usuario_id)
    REFERENCES usuarios_turismo(id)
);







SELECT * FROM usuarios;

SELECT * FROM usuarios_turismo;

SELECT * FROM materiales;

UPDATE usuarios
SET is_active = 1
WHERE email = '244650@ulsaneza.edu.mx';

UPDATE usuarios
SET is_active = 1
WHERE email = 'dano.alexper@gmail.com';

UPDATE usuarios
SET rol = 'MAESTRO'
WHERE id = 2;


UPDATE usuarios
SET is_active = 1
WHERE email = 'trenqOT@gmail.com';

SELECT * FROM usuarios_turismo;

UPDATE usuarios_turismo
SET rol = 'ADMIN'
WHERE id = 3;


UPDATE usuarios_turismo
SET is_active = 1
WHERE email = '243576@ulsaneza.edu.mx';

UPDATE usuarios_turismo
SET is_active = 1
WHERE email = 'sankip.alex@gmail.com';

UPDATE usuarios_turismo
SET rol = 'ADMIN'
WHERE id = 3;


SHOW VARIABLES LIKE '%ssl%';
	SHOW STATUS LIKE 'Ssl_cipher';
    SET PERSIST require_secure_transport = ON;
    SHOW VARIABLES LIKE 'require_secure_transport';
SHOW VARIABLES LIKE 'ssl_%';


ALTER TABLE equipo_integrantes
  ADD COLUMN firma_imagen VARCHAR(255) NULL AFTER usuario_id,
  ADD COLUMN firmado_at   TIMESTAMP    NULL AFTER firma_imagen;

-- (opcional) indice para auditar firmas por fecha
CREATE INDEX idx_equipo_integrantes_firmado_at
  ON equipo_integrantes (firmado_at);


select * from equipo_integrantes

























