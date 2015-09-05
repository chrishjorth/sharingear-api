/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name : ['Sharingear API'],
  /**
   * Your New Relic license key.
   */
  license_key : 'c793088d650be2cff047033a605227a3752bc26a',
  logging : {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level : 'warn',
    filepath : '/home/ubuntu/sg_logs/newrelic_agent.log'
  }
};
