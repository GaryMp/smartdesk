const form = document.getElementById('support-form');
const button = document.getElementById('submit-button');
const statusMessage = document.getElementById('form-status');
const resultTitle = document.getElementById('result-title');
const resultPlaceholder = document.getElementById('result-placeholder');
const resultContent = document.getElementById('result-content');

const category = document.getElementById('result-category');
const priority = document.getElementById('result-priority');
const summary = document.getElementById('result-summary');

const CATEGORY_LABELS = {
  access: 'Acceso',
  technical_error: 'Error técnico',
  query: 'Consulta',
  other: 'Otra'
};

const PRIORITY_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta'
};

function label(map, value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return map[value] ?? String(value);
}

function showStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
}

function clearResult() {
  resultContent.hidden = true;
  resultPlaceholder.hidden = false;
}

function showResult(data) {
  const analysis = data?.analisisIA;

  if (!analysis || typeof analysis !== 'object') {
    throw new Error(
      'La solicitud fue recibida, pero la respuesta no contiene el análisis esperado.'
    );
  }

  category.textContent = label(CATEGORY_LABELS, analysis.category, 'No informada');
  priority.textContent = label(PRIORITY_LABELS, analysis.priority, 'No informada');
  summary.textContent = analysis.summary || 'Sin resumen disponible';

  resultPlaceholder.hidden = true;
  resultContent.hidden = false;

  return analysis.parseOk !== false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  const payload = {
    subject: form.elements.subject.value.trim(),
    description: form.elements.description.value.trim()
  };

  if (!payload.subject || !payload.description) {
    showStatus('Completa ambos campos antes de continuar.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Enviando solicitud…';
  form.setAttribute('aria-busy', 'true');
  showStatus('Enviando solicitud y esperando el análisis…');

  clearResult();

  try {
    const response = await fetch('/support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = typeof data?.message === 'string'
        ? data.message
        : 'No fue posible procesar la solicitud.';

      throw new Error(detail);
    }

    let analysisParsed;

    try {
      analysisParsed = showResult(data);
    } catch (error) {
      showStatus(
        error.message,
        'error'
      );
      return;
    }

    showStatus(
      analysisParsed
        ? 'Solicitud procesada. El análisis está disponible.'
        : 'Solicitud registrada. La IA no devolvió un análisis interpretable; se muestran valores por defecto.',
      'success'
    );

    form.reset();
    resultTitle.focus();
  } catch (error) {
    showStatus(
      error instanceof TypeError
        ? 'No fue posible conectar con el backend. Comprueba que esté funcionando.'
        : error.message || 'Ocurrió un error al enviar la solicitud.',
      'error'
    );
  } finally {
    button.disabled = false;
    button.textContent = 'Enviar solicitud';
    form.removeAttribute('aria-busy');
  }
});
