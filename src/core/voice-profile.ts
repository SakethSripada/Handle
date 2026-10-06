// Keep native telephone audio: resampling cannot restore missing bandwidth.
export const phoneVoice = {
    voice_id: 'cjVigY5qzO86Huf0OWal', // Eric: American, conversational.
    model_id: 'eleven_v4_turbo',
    agent_output_audio_format: 'ulaw_8000',
    expressive_mode: true,
    stability: 0.5,
    similarity_boost: 0.75,
    speed: 1,
};

// Keep short acknowledgements from chopping off the agent's answer.
export const phoneTurn = {
    turn_timeout: 10,
    silence_end_call_timeout: -1,
    turn_eagerness: 'normal',
    interruption_ignore_terms: ['uh-huh', 'mm-hmm', 'yeah', 'okay'],
    interruption_ignore_term_languages: ['en'],
    merge_with_default_ignore_terms: true,
    transcribe_on_disabled_interruptions: true,
};
