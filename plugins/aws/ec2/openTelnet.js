var async = require('async');
var helpers = require('../../../helpers/aws');

module.exports = {
    title: 'Open Telnet',
    category: 'EC2',
    description: 'Determine if TCP port 23 for Telnet is open to the public',
    more_info: 'While some ports such as HTTP and HTTPS are required to be open to the public to function properly, more sensitive services such as Telnet should be restricted to known IP addresses.',
    link: 'http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html',
    recommended_action: 'Restrict TCP port 23 to known IP addresses',
    apis: ['EC2:describeSecurityGroups'],
    remediation_description: 'The impacted security group rule will be deleted if no input is provided. Otherwise, any input will replace the open CIDR rule.',
    apis_remediate: ['EC2:describeSecurityGroups'],
    actions: {
        remediate: ['EC2:authorizeSecurityGroupIngress','EC2:revokeSecurityGroupIngress'],
        rollback: ['EC2:authorizeSecurityGroupIngress']
    },
    permissions: {
        remediate: ['ec2:AuthorizeSecurityGroupIngress','ec2:RevokeSecurityGroupIngress'],
        rollback:['ec2:AuthorizeSecurityGroupIngress']
    },
    realtime_triggers: ['ec2:AuthorizeSecurityGroupIngress'],

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions(settings);

        var ports = {
            'tcp': [23]
        };

        var service = 'Telnet';

        async.each(regions.ec2, function(region, rcb){
            var describeSecurityGroups = helpers.addSource(cache, source,
                ['ec2', 'describeSecurityGroups', region]);

            if (!describeSecurityGroups) return rcb();

            if (describeSecurityGroups.err || !describeSecurityGroups.data) {
                helpers.addResult(results, 3,
                    'Unable to query for security groups: ' + helpers.addError(describeSecurityGroups), region);
                return rcb();
            }

            if (!describeSecurityGroups.data.length) {
                helpers.addResult(results, 0, 'No security groups present', region);
                return rcb();
            }

            helpers.findOpenPorts(describeSecurityGroups.data, ports, service, region, results);

            rcb();
        }, function(){
            callback(null, results, source);
        });
    },
    remediate: function(config, cache, settings, resource, callback) {
        var remediation_file = settings.remediation_file;
        var putCall = this.actions.remediate;
        var pluginName = 'openTelnet';
        var protocol = 'tcp';
        var port = 23;

        helpers.remediateOpenPorts(putCall, pluginName, protocol, port, config, cache, settings, resource, remediation_file, function(error, action) {
            if (error && (error.length || Object.keys(error).length)) {
                remediation_file['post_remediate']['actions'][pluginName]['error'] = error;
                settings.remediation_file = remediation_file;
                return callback(error, null);
            } else {
                remediation_file['post_remediate']['actions'][pluginName][resource] = action;
                settings.remediation_file = remediation_file;
                return callback(null, action);
            }
        });
    }
};
