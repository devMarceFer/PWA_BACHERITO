export function errorHandler(err, req, res, next) {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'El archivo enviado es demasiado grande.' });
    }

    console.error('❌ [Error Global API]:', err.stack || err.message || err);

    return res.status(500).json({
        success: false,
        message: 'Ocurrió un error interno en el servidor.',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Consulte los logs del sistema.'
    });
}