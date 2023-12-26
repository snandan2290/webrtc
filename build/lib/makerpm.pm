#!/usr/bin/perl --
package makerpm;
use strict;
no warnings 'uninitialized';

BEGIN
{  
   ($ENV{USER}) || chomp($ENV{USER}=`whoami`);
   ($ENV{SCRIPT_DIR},$ENV{SCRIPT})=($0=~/(.*)\/([^\/]+)/);
   ((!$ENV{SCRIPT_DIR}) || ($ENV{SCRIPT_DIR} eq '.')) && chomp($ENV{SCRIPT_DIR}=`/bin/pwd`);
   ($ENV{SCRIPT}) || ($ENV{SCRIPT}=$0);
}

###############################################################################
sub run
{
   my ($ra_files)=@_;

   # directory where the SPEC files are
   chdir($ENV{SCRIPT_DIR});
   
   if ($#$ra_files == -1)
   {
      my @Specs=<{*.spec}>;
      $ra_files=\@Specs;
   }
   
   # directory where the rpmbuild directory lives
   if (!$ENV{TOPDIR})
   {
      if (-d "/me")
      {
         $ENV{TOPDIR}="/me/rpmbuild";
      }
      else
      {
         $ENV{TOPDIR}="$ENV{HOME}/rpmbuild";
      }
   }
   system("mkdir -p $ENV{TOPDIR}/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}");
   
   # directory where the source should exist
   chomp($ENV{SOURCE_DIR}=`cd .. && /bin/pwd`);

   # Put together rpmbuild command line
   my @RPMBUILD_OPTS;
   push(@RPMBUILD_OPTS, "--define='_version 1.0.0'"); # should be unused in SPEC
   push(@RPMBUILD_OPTS, "--define='_topdir $ENV{TOPDIR}'");
   push(@RPMBUILD_OPTS, "--define='_sourcedir $ENV{SOURCE_DIR}'");
   push(@RPMBUILD_OPTS, "--define='_id $ENV{USER}'");
   my $RPMBUILD_OPTS=join(' ', @RPMBUILD_OPTS);
   
   my $ret=0;
   foreach my $spec (@$ra_files)
   {
      my $command="/usr/bin/rpmbuild $RPMBUILD_OPTS -ba $spec";
      print "$command\n";
      $ret=system($command);
      ($ret) && last; # abort after first error
   }
   return($ret);
}
###############################################################################
1;
