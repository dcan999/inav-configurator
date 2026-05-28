'use strict';

import MSPCodes from './../js/msp/MSPCodes';
import MSP from './../js/msp';
import { GUI, TABS } from './../js/gui';
import FC from './../js/fc';
import Settings from './../js/settings';
import i18n from './../js/localization';

TABS.advanced_tuning = {};

const AIRSPEED_CRUISE_RESPONSE_CUSTOM = '3';

const AIRSPEED_CRUISE_PRESETS = {
    '0': {
        p: 600,
        i: 350,
        d: 30,
        ff: 250,
        slew: 600,
        decay: 50,
    },
    '1': {
        p: 800,
        i: 550,
        d: 50,
        ff: 350,
        slew: 900,
        decay: 50,
    },
    '2': {
        p: 1000,
        i: 750,
        d: 70,
        ff: 450,
        slew: 1200,
        decay: 50,
    },
};

const AIRSPEED_CRUISE_TUNING_FIELDS = {
    p: '#airspeedCruisePGain',
    i: '#airspeedCruiseIGain',
    d: '#airspeedCruiseDGain',
    ff: '#airspeedCruiseFFGain',
    slew: '#airspeedCruiseSlewRate',
    decay: '#airspeedCruiseDecayRate',
};

function applyAirspeedCruisePresetToTuningFields() {
    const response = $('#airspeedCruiseResponse').val();
    const preset = AIRSPEED_CRUISE_PRESETS[response];

    // Custom mode uses the raw values stored on the FC, so do not overwrite them.
    if (!preset) {
        return;
    }

    $(AIRSPEED_CRUISE_TUNING_FIELDS.p).val(preset.p);
    $(AIRSPEED_CRUISE_TUNING_FIELDS.i).val(preset.i);
    $(AIRSPEED_CRUISE_TUNING_FIELDS.d).val(preset.d);
    $(AIRSPEED_CRUISE_TUNING_FIELDS.ff).val(preset.ff);
    $(AIRSPEED_CRUISE_TUNING_FIELDS.slew).val(preset.slew);
    $(AIRSPEED_CRUISE_TUNING_FIELDS.decay).val(preset.decay);
}

function updateAirspeedAdvancedPidToggle() {
    const details = $('.airspeed-advanced-pid-adjustment');
    const arrow = details.find('.airspeed-advanced-pid-arrow');

    arrow.text(details.prop('open') ? '▼' : '▶');
}

function scheduleInitialAirspeedCruisePresetApply() {
    // Settings binding can finish after the tab JS runs, depending on MSP timing.
    // Retry briefly so preset boxes populate on first page load without touching the dropdown.
    [0, 100, 250, 500, 1000, 1500].forEach((delay) => {
        setTimeout(applyAirspeedCruisePresetToTuningFields, delay);
    });
}

function setupAirspeedCruiseTuningUi() {
    const tuningFieldSelector = Object.values(AIRSPEED_CRUISE_TUNING_FIELDS).join(', ');

    updateAirspeedAdvancedPidToggle();
    scheduleInitialAirspeedCruisePresetApply();

    $('.airspeed-advanced-pid-adjustment').on('toggle', function () {
        updateAirspeedAdvancedPidToggle();
    });

    $('#airspeedCruiseResponse').on('change', function () {
        applyAirspeedCruisePresetToTuningFields();
    });

    $(tuningFieldSelector).on('input change', function () {
        if ($('#airspeedCruiseResponse').val() !== AIRSPEED_CRUISE_RESPONSE_CUSTOM) {
            $('#airspeedCruiseResponse').val(AIRSPEED_CRUISE_RESPONSE_CUSTOM);
            updateAirspeedAdvancedPidToggle();
        }
    });
}

TABS.advanced_tuning.initialize = function (callback) {

    if (GUI.active_tab != 'advanced_tuning') {
        GUI.active_tab = 'advanced_tuning';
    }

    import('./advanced_tuning.html?raw').then(({default: html}) => GUI.load(html, Settings.processHtml(processHtml)));

    function save_to_eeprom() {
        console.log('save_to_eeprom');
        MSP.send_message(MSPCodes.MSP_EEPROM_WRITE, false, false, function () {
            GUI.log(i18n.getMessage('eepromSaved'));

            GUI.tab_switch_cleanup(function () {
                MSP.send_message(MSPCodes.MSP_SET_REBOOT, false, false, function () {
                    GUI.log(i18n.getMessage('deviceRebooting'));
                    GUI.handleReconnect($('.tab_advanced_tuning a'));
                });
            });
        });
    }

    function processHtml() {
        if (FC.isAirplane()) {
            $('.airplaneTuning').show();
            $('.airplaneTuningTitle').show();
            $('.multirotorTuning').hide();
            $('.multirotorTuningTitle').hide();
            $('.notFixedWingTuning').hide();
        } else if (FC.isMultirotor()) {
            $('.airplaneTuning').hide();
            $('.airplaneTuningTitle').hide();
            $('.multirotorTuning').show();
            $('.multirotorTuningTitle').show();
            $('.notFixedWingTuning').show();
        } else {
            $('.airplaneTuning').show();
            $('.airplaneTuningTitle').hide();
            $('.multirotorTuning').show();
            $('.multirotorTuningTitle').hide();
            $('.notFixedWingTuning').show();
        }

        if (!FC.isFeatureEnabled('GEOZONE')) {
            $('#geozoneSettings').hide();
        }

        GUI.simpleBind();

        i18n.localize();;
        setupAirspeedCruiseTuningUi();
        
        // Set up required field warnings
        $('#launchIdleThr').on('keyup', () => {
            TABS.advanced_tuning.checkRequirements_IdleThrottle();
        });

        $('#launchIdleDelay').on('keyup', () => {
            TABS.advanced_tuning.checkRequirements_IdleThrottle();
        });

        $('#wiggleWakeIdle').on('change', function () {
            TABS.advanced_tuning.checkRequirements_IdleThrottle();
        });

        $('#rthHomeAltitude').on('keyup', () => {
            TABS.advanced_tuning.checkRequirements_LinearDescent();
        });

        $('#rthUseLinearDescent').on('change', function () {
            TABS.advanced_tuning.checkRequirements_LinearDescent();
        });

        // Preload required field warnings
        TABS.advanced_tuning.checkRequirements_IdleThrottle();
        TABS.advanced_tuning.checkRequirements_LinearDescent();

        $('a.save').on('click', function () {
            Settings.saveInputs(save_to_eeprom);
        });
        GUI.content_ready(callback);
    }
};


TABS.advanced_tuning.checkRequirements_IdleThrottle = function() {
    let idleThrottle = $('#launchIdleThr');
    if (($('#launchIdleDelay').val() > 0 || $('#wiggleWakeIdle').find(":selected").val() > 0) && (idleThrottle.val() == "" || idleThrottle.val() < "1150")) {
        idleThrottle.addClass('inputRequiredWarning');
    } else {
        idleThrottle.removeClass('inputRequiredWarning');
    }
};

TABS.advanced_tuning.checkRequirements_LinearDescent = function() {
    let rthHomeAlt = $('#rthHomeAltitude');
    let minRthHomeAlt = 1000.0 / rthHomeAlt.data('setting-multiplier'); // 10 metres minimum recommended for safety.
    
    if ($('#rthUseLinearDescent').is(":checked") && (rthHomeAlt.val() == "" || parseFloat(rthHomeAlt.val()) < minRthHomeAlt)) {
        rthHomeAlt.addClass('inputRequiredWarning');
    } else {
        rthHomeAlt.removeClass('inputRequiredWarning');
    }
};

TABS.advanced_tuning.cleanup = function (callback) {
    if (callback) callback();
};
